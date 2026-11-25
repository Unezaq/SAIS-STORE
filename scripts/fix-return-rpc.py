with open('supabase/migrations/20261124_02_cancellation_and_returns.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add v_cumulative to DECLARE section
old_declare = "  v_parsed_color text;\n  v_parsed_size text;\n  v_message text;"
new_declare = "  v_parsed_color text;\n  v_parsed_size text;\n  v_message text;\n  v_cumulative jsonb := '{}'::jsonb;\n  v_cum_key text;"
assert old_declare in content, "declare pattern not found"
content = content.replace(old_declare, new_declare)

# 2. Fix the ordered_qty query to match by product_id AND variant_id (via order_items.variant text)
# The current query matches by product_id only. We need to also match the variant.
# But the order_items.variant is text like "Rouge / M", while we have variant_id UUID.
# For now, keep matching by product_id but add cumulative tracking.

# 3. Add cumulative tracking before the qty check
old_check = """      if v_qty > v_ordered_qty then
        raise exception 'QUANTITE_INVALIDE: Quantité retournée supérieure à la quantité commandée.';
      end if;"""

new_check = """      -- Cumulative guard: prevent the same (product, variant) from being
      -- returned more than ordered across multiple lines in p_return_items.
      v_cum_key := coalesce(v_product_id::text, '') || '|' || coalesce(v_variant_id::text, '');
      if v_cumulative ? v_cum_key then
        if (v_cumulative->v_cum_key)::integer + v_qty > v_ordered_qty then
          raise exception 'QUANTITE_INVALIDE: Quantité retournée supérieure à la quantité commandée.';
        end if;
      else
        if v_qty > v_ordered_qty then
          raise exception 'QUANTITE_INVALIDE: Quantité retournée supérieure à la quantité commandée.';
        end if;
      end if;

      -- Update cumulative tracker
      if v_cumulative ? v_cum_key then
        v_cumulative := v_cumulative || jsonb_build_object(v_cum_key, (v_cumulative->v_cum_key)::integer + v_qty);
      else
        v_cumulative := v_cumulative || jsonb_build_object(v_cum_key, v_qty);
      end if;"""

assert old_check in content, "qty check pattern not found"
content = content.replace(old_check, new_check)

with open('supabase/migrations/20261124_02_cancellation_and_returns.sql', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
