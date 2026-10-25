-- Drinks split into two shelves in the app: bottled/canned "soft" drinks and Ghanaian
-- "local" drinks (sobolo, ginger, watermelon, asaana, pito…). Only drinks carry a type.
alter table menu_items add column drink_type varchar(10);

update menu_items set drink_type = case
    when lower(name || ' ' || coalesce(description, '')) ~ '\y(sobolo|bissap|hibiscus|ginger|watermelon|pineapple|asaana|pito|brukina|burkina|lamugin|tamarind|tigernut|coconut|fresh|local|homemade|zomi)\y' then 'local'
    else 'soft'
end
where category = 'drinks';

alter table menu_items add constraint menu_items_drink_type_chk
    check ((category = 'drinks' and drink_type in ('soft', 'local')) or (category <> 'drinks' and drink_type is null));
