-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Create user_profiles table
create table if not exists user_profiles (
    id uuid primary key default uuid_generate_v4(),
    user_id text not null unique,
    display_name text,
    photo_url text,
    bio text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    settings jsonb default '{}'::jsonb
);

-- Create teams table
create table if not exists teams (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    created_by text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    settings jsonb default '{}'::jsonb
);

-- Create team_members table for team memberships
create table if not exists team_members (
    id uuid primary key default uuid_generate_v4(),
    team_id uuid references teams(id) on delete cascade,
    user_id text not null,
    role text not null check (role in ('admin', 'member', 'guest')),
    joined_at timestamp with time zone default now(),
    unique(team_id, user_id)
);

-- Create events table
create table if not exists events (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    description text,
    date date not null,
    time time not null,
    location text,
    type text not null check (type in ('conference', 'workshop', 'seminar', 'other')),
    status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')),
    team_id uuid references teams(id),
    created_by text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    settings jsonb default '{}'::jsonb
);

-- Create event_participants table
create table if not exists event_participants (
    id uuid primary key default uuid_generate_v4(),
    event_id uuid references events(id) on delete cascade,
    user_id text not null,
    role text not null check (role in ('organizer', 'speaker', 'attendee')),
    status text not null default 'registered' check (status in ('registered', 'attended', 'cancelled')),
    registered_at timestamp with time zone default now(),
    unique(event_id, user_id)
);

-- Create analytics_events table for event analytics
create table if not exists analytics_events (
    id uuid primary key default uuid_generate_v4(),
    event_id uuid references events(id) on delete cascade,
    views integer default 0,
    registrations integer default 0,
    attendance integer default 0,
    feedback_score numeric(3,2),
    recorded_at timestamp with time zone default now()
);

-- Create user_analytics table for user engagement
create table if not exists user_analytics (
    id uuid primary key default uuid_generate_v4(),
    user_id text not null,
    events_created integer default 0,
    events_attended integer default 0,
    total_participation_hours numeric(10,2) default 0,
    last_active timestamp with time zone,
    recorded_at timestamp with time zone default now()
);

-- Create notifications table
create table if not exists notifications (
    id uuid primary key default uuid_generate_v4(),
    user_id text not null,
    title text not null,
    message text not null,
    type text not null check (type in ('event', 'team', 'system')),
    read boolean default false,
    created_at timestamp with time zone default now()
);

-- Create RLS policies

-- User Profiles policy
alter table user_profiles enable row level security;
create policy "Users can view any profile"
    on user_profiles for select
    using (true);
create policy "Users can update own profile"
    on user_profiles for update
    using (auth.uid() = user_id);
create policy "Users can insert own profile"
    on user_profiles for insert
    with check (auth.uid() = user_id);

-- Teams policy
alter table teams enable row level security;
create policy "Anyone can view teams"
    on teams for select
    using (true);
create policy "Team creators can update"
    on teams for update
    using (auth.uid() = created_by);
create policy "Authenticated users can create teams"
    on teams for insert
    with check (auth.uid() = created_by);
create policy "Team creators can delete"
    on teams for delete
    using (auth.uid() = created_by);

-- Events policy
alter table events enable row level security;
create policy "Anyone can view events"
    on events for select
    using (true);
create policy "Event creators can update"
    on events for update
    using (auth.uid() = created_by);
create policy "Authenticated users can create events"
    on events for insert
    with check (auth.uid() = created_by);
create policy "Event creators can delete"
    on events for delete
    using (auth.uid() = created_by);

-- Create indexes for performance
create index if not exists idx_events_date on events(date);
create index if not exists idx_events_type on events(type);
create index if not exists idx_events_status on events(status);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_event_participants_user on event_participants(user_id);
create index if not exists idx_notifications_user on notifications(user_id, read);

-- Create functions for analytics
create or replace function update_event_analytics()
returns trigger as $$
begin
    insert into analytics_events (event_id, views, registrations, attendance)
    values (NEW.id, 0, 0, 0)
    on conflict (event_id) do nothing;
    return NEW;
end;
$$ language plpgsql;

create trigger event_analytics_trigger
after insert on events
for each row
execute function update_event_analytics();

-- Create function to update user analytics
create or replace function update_user_analytics()
returns trigger as $$
begin
    insert into user_analytics (user_id, events_created, events_attended)
    values (NEW.created_by, 1, 0)
    on conflict (user_id) do update
    set events_created = user_analytics.events_created + 1,
        last_active = now();
    return NEW;
end;
$$ language plpgsql;

create trigger user_analytics_trigger
after insert on events
for each row
execute function update_user_analytics();