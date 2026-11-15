alter table public.clients
  alter column email drop not null;

alter table public.clients
  drop constraint if exists clients_email_key;
