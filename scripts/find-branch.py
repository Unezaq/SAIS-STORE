with open('supabase/migrations/20261124_02_cancellation_and_returns.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the explicit items branch
marker = "  if jsonb_array_length(p_return_items) = 0 then"
idx = content.find(marker)
print(f"Found at: {idx}")
# Find the 'else' after this
else_idx = content.find("  else", idx)
print(f"else at: {else_idx}")
# Print from else to the end of the loop
print(content[else_idx:else_idx+2000])
