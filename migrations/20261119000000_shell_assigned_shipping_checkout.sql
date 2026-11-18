-- Customer checkout now uses each shell's assigned shipping_fee record.
-- Apply this migration after public.shipping_fee exists. Existing order delivery_fee
-- values remain untouched; order-item shipping snapshots apply to new orders only.

begin;

do $$
begin
  if to_regclass('public.shipping_fee') is null then
    raise exception 'public.shipping_fee must exist before applying assigned-shipping checkout';
  end if;
end $$;

alter table public.shell_description
  add column if not exists shipping_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shell_description_shipping_id_fkey'
      and conrelid = 'public.shell_description'::regclass
  ) then
    alter table public.shell_description
      add constraint shell_description_shipping_id_fkey
      foreign key (shipping_id) references public.shipping_fee(id);
  end if;
end $$;

alter table public.shop_order_items
  add column if not exists shipping_id uuid,
  add column if not exists shipping_name text,
  add column if not exists unit_shipping_fee numeric,
  add column if not exists shipping_total numeric;

-- Discounted orders include shipping in the total formula. NOT VALID preserves
-- existing historical rows while PostgreSQL checks all new or changed rows.
alter table public.shop_orders drop constraint if exists shop_orders_check;
alter table public.shop_orders drop constraint if exists shop_orders_total_pricing_check;
alter table public.shop_orders
  add constraint shop_orders_total_pricing_check
  check (total = subtotal + delivery_fee - discount_amount) not valid;

drop function if exists public.shop_create_order_with_options(uuid,uuid,text,text,text,jsonb,text,numeric,timestamptz,text,uuid,text);
drop function if exists public.shop_create_order(uuid,uuid,text,text,text,jsonb,text,numeric,timestamptz);

create or replace function public.shop_cart_snapshot(p_session_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_cart public.shop_carts%rowtype;
  v_items jsonb;
begin
  if not exists (select 1 from public.shop_sessions where session_id = p_session_id) then
    raise exception using errcode = '28000', message = 'Shop session is invalid.';
  end if;
  select * into v_cart from public.shop_carts
   where session_id = p_session_id and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('cart_id', null, 'items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'shell_id', ci.shell_id,
    'quantity', ci.quantity,
    'shell_name', sd.shell_name,
    'price', sd.price,
    'is_deleted', sd.is_deleted,
    'available', private.shop_available_stock(ci.shell_id),
    'shipping_id', sd.shipping_id,
    'shipping_name', sf.shipping_name,
    'shipping_fee', sf.shipping_fee,
    'shipping_fee_is_active', sf.is_active
  ) order by sd.shell_name), '[]'::jsonb)
    into v_items
    from public.shop_cart_items ci
    join public.shell_description sd on sd.shell_id = ci.shell_id
    left join public.shipping_fee sf on sf.id = sd.shipping_id
   where ci.cart_id = v_cart.cart_id;

  update public.shop_sessions set last_seen_at = now() where session_id = p_session_id;
  return jsonb_build_object('cart_id', v_cart.cart_id, 'items', v_items);
end;
$$;

create or replace function public.shop_create_order(
  p_session_id uuid,
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_delivery_address jsonb,
  p_currency text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_cart public.shop_carts%rowtype;
  v_existing public.shop_orders%rowtype;
  v_order public.shop_orders%rowtype;
  v_item record;
  v_subtotal numeric := 0;
  v_shipping_total numeric := 0;
  v_line_total numeric;
  v_line_shipping_total numeric;
  v_total numeric;
  v_order_number text;
  v_items jsonb;
  v_available numeric;
begin
  perform 1 from public.shop_sessions where session_id = p_session_id for update;
  if not found then
    raise exception using errcode = '28000', message = 'Shop session is invalid.';
  end if;

  select * into v_existing from public.shop_orders
   where session_id = p_session_id and idempotency_key = p_idempotency_key;
  if found then
    select coalesce(jsonb_agg(to_jsonb(oi) order by oi.created_at), '[]'::jsonb)
      into v_items from public.shop_order_items oi where oi.order_id = v_existing.order_id;
    return jsonb_build_object('order', to_jsonb(v_existing), 'items', v_items);
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$'
     or p_delivery_address is null or jsonb_typeof(p_delivery_address) <> 'object' then
    raise exception using errcode = '22023', message = 'Checkout configuration or delivery information is invalid.';
  end if;
  select * into v_cart from public.shop_carts
   where session_id = p_session_id and status = 'active' for update;
  if not found or not exists (select 1 from public.shop_cart_items where cart_id = v_cart.cart_id) then
    raise exception using errcode = 'P0002', message = 'The cart is empty.';
  end if;

  -- Stable product lock order prevents concurrent checkouts selling the same stock.
  perform sd.shell_id
    from public.shop_cart_items ci
    join public.shell_description sd on sd.shell_id = ci.shell_id
   where ci.cart_id = v_cart.cart_id
   order by sd.shell_id
   for update of sd;

  for v_item in
    select ci.shell_id, ci.quantity, sd.shell_name, sd.price, sd.is_deleted,
           sd.shipping_id, sf.shipping_name, sf.shipping_fee
      from public.shop_cart_items ci
      join public.shell_description sd on sd.shell_id = ci.shell_id
      left join public.shipping_fee sf on sf.id = sd.shipping_id
     where ci.cart_id = v_cart.cart_id
     order by sd.shell_id
  loop
    if coalesce(v_item.is_deleted, false) or v_item.price is null or v_item.price <= 0 then
      raise exception using errcode = '22023', message = 'A cart item is no longer available for purchase.';
    end if;
    if v_item.shipping_id is not null and (v_item.shipping_fee is null or v_item.shipping_fee < 0) then
      raise exception using errcode = '22023', message = 'shipping_fee_invalid';
    end if;
    v_available := private.shop_available_stock(v_item.shell_id);
    if v_item.quantity > v_available then
      raise exception using errcode = '22003', message = 'A cart item no longer has enough available stock.';
    end if;
    v_line_total := v_item.price * v_item.quantity;
    v_line_shipping_total := coalesce(v_item.shipping_fee, 0) * v_item.quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_shipping_total := v_shipping_total + v_line_shipping_total;
  end loop;

  if v_subtotal <= 0 then
    raise exception using errcode = '22023', message = 'The order total must be greater than zero.';
  end if;
  v_total := v_subtotal + v_shipping_total;
  v_order_number := 'SS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0');

  insert into public.shop_orders(
    order_number, session_id, cart_id, idempotency_key, customer_name, customer_email,
    customer_phone, delivery_address, currency, subtotal, delivery_fee, total, expires_at
  ) values (
    v_order_number, p_session_id, v_cart.cart_id, p_idempotency_key, trim(p_customer_name),
    lower(trim(p_customer_email)), trim(p_customer_phone), p_delivery_address,
    p_currency, v_subtotal, v_shipping_total, v_total, p_expires_at
  ) returning * into v_order;

  insert into public.shop_order_items(
    order_id, shell_id, shell_name, quantity, unit_price, line_total,
    shipping_id, shipping_name, unit_shipping_fee, shipping_total
  )
  select v_order.order_id, sd.shell_id, coalesce(sd.shell_name, ''), ci.quantity,
         sd.price, sd.price * ci.quantity, sd.shipping_id, sf.shipping_name,
         sf.shipping_fee, coalesce(sf.shipping_fee, 0) * ci.quantity
    from public.shop_cart_items ci
    join public.shell_description sd on sd.shell_id = ci.shell_id
    left join public.shipping_fee sf on sf.id = sd.shipping_id
   where ci.cart_id = v_cart.cart_id;

  update public.shop_carts set status = 'converted', updated_at = now() where cart_id = v_cart.cart_id;
  update public.shop_sessions set last_seen_at = now() where session_id = p_session_id;
  select coalesce(jsonb_agg(to_jsonb(oi) order by oi.created_at), '[]'::jsonb)
    into v_items from public.shop_order_items oi where oi.order_id = v_order.order_id;
  return jsonb_build_object('order', to_jsonb(v_order), 'items', v_items);
end;
$$;

create or replace function public.shop_create_order_with_options(
  p_session_id uuid,
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_delivery_address jsonb,
  p_currency text,
  p_expires_at timestamptz,
  p_discount_code text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  bundle jsonb;
  order_id_value uuid;
  updated_order jsonb;
begin
  bundle := public.shop_create_order(
    p_session_id, p_idempotency_key, p_customer_name, p_customer_email,
    p_customer_phone, p_delivery_address, p_currency, p_expires_at
  );
  order_id_value := (bundle->'order'->>'order_id')::uuid;
  if p_discount_code is not null then
    updated_order := public.shop_apply_discount(order_id_value, p_session_id, p_discount_code);
    bundle := jsonb_set(bundle, '{order}', updated_order);
  end if;
  return bundle;
end;
$$;

create or replace function public.shop_apply_discount(p_order_id uuid, p_session_id uuid, p_code text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  o public.shop_orders%rowtype;
  d public.shop_discount_codes%rowtype;
  amount numeric(12,2);
  customer_uses integer;
begin
  select * into o from public.shop_orders
   where order_id = p_order_id and session_id = p_session_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.payment_status <> 'pending' then raise exception 'order_not_pending'; end if;
  if o.discount_code is not null then
    if upper(o.discount_code) = upper(p_code) then return to_jsonb(o); end if;
    raise exception 'discount_already_applied';
  end if;
  if o.paypal_order_id is not null then raise exception 'order_pricing_locked'; end if;
  select * into d from public.shop_discount_codes where code = upper(p_code) for update;
  if not found or not d.active then raise exception 'discount_invalid'; end if;
  if d.starts_at is not null and d.starts_at > now() then raise exception 'discount_invalid'; end if;
  if d.expires_at is not null and d.expires_at <= now() then raise exception 'discount_invalid'; end if;
  if d.usage_limit is not null and d.usage_count >= d.usage_limit then raise exception 'discount_invalid'; end if;
  if o.subtotal < d.minimum_subtotal then raise exception 'discount_invalid'; end if;
  if d.per_customer_limit is not null then
    select count(*) into customer_uses from public.shop_discount_usages
     where discount_id = d.discount_id and session_id = p_session_id;
    if customer_uses >= d.per_customer_limit then raise exception 'discount_invalid'; end if;
  end if;
  amount := case when d.discount_type = 'percentage'
    then round(o.subtotal * d.discount_value / 100, 2) else d.discount_value end;
  if d.maximum_discount is not null then amount := least(amount, d.maximum_discount); end if;
  amount := least(amount, o.subtotal);
  update public.shop_orders
     set discount_code = d.code, discount_amount = amount,
         total = subtotal + delivery_fee - amount, updated_at = now()
   where order_id = p_order_id returning * into o;
  insert into public.shop_discount_usages(discount_id, order_id, session_id, discount_amount)
    values (d.discount_id, p_order_id, p_session_id, amount);
  update public.shop_discount_codes
     set usage_count = usage_count + 1, updated_at = now()
   where discount_id = d.discount_id;
  return to_jsonb(o);
end;
$$;

revoke all on function public.shop_cart_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.shop_cart_snapshot(uuid) to service_role;
revoke all on function public.shop_create_order(uuid,uuid,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.shop_create_order(uuid,uuid,text,text,text,jsonb,text,timestamptz) to service_role;
revoke all on function public.shop_create_order_with_options(uuid,uuid,text,text,text,jsonb,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.shop_create_order_with_options(uuid,uuid,text,text,text,jsonb,text,timestamptz,text) to service_role;
revoke all on function public.shop_apply_discount(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.shop_apply_discount(uuid,uuid,text) to service_role;

commit;
