-- Give each meal an explicit category so the app groups them into tabs
-- (Rice / Chicken / Salad / Drinks) instead of guessing from the name.
-- Admin now sets this when posting a meal.
alter table menu_items add column category varchar(20);

-- Backfill existing rows from their name + description, using the same keyword
-- priority the mobile app used (rice wins over chicken for e.g. "Jollof Rice with Chicken").
update menu_items set category = case
    when lower(name || ' ' || coalesce(description, '')) ~ '\y(drinks?|juice|water|soda|malt|cola|coke|fanta|sprite|smoothie|coffee|tea|lemonade|milkshake|beverage)\y' then 'drinks'
    when lower(name || ' ' || coalesce(description, '')) ~ '\y(rice|jollof|waakye|banku|fufu|pilau|noodles?|spaghetti|pasta)\y' then 'rice'
    when lower(name || ' ' || coalesce(description, '')) ~ '\y(chicken|wings?|drumsticks?)\y' then 'chicken'
    when lower(name || ' ' || coalesce(description, '')) ~ '\ysalad\y' then 'salad'
    else 'rice'
end
where category is null;

alter table menu_items alter column category set not null;
alter table menu_items add constraint menu_items_category_chk
    check (category in ('rice', 'chicken', 'salad', 'drinks'));
