// Supabase configuration
const SUPABASE_URL = 'https://gjhtbwgnfjtquahzxlwx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqaHRid2duZmp0cXVhaHp4bHd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTU0ODQ4MDAsImV4cCI6MjAxMTA2MDgwMH0.O41J_9g-qkDWHqog9nR6ayBfNzUZ5_k8thH9-NHq36Q';

// Initialize Supabase client
async function initSupabase() {
    try {
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        return supabaseClient;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        throw error;
    }
}

// Database operations for Events
const eventOperations = {
    async createEvent(eventData) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('events')
            .insert([eventData]);
        if (error) throw error;
        return data;
    },

    async getEvents() {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('events')
            .select('*');
        if (error) throw error;
        return data;
    },

    async getEventById(eventId) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();
        if (error) throw error;
        return data;
    },

    async updateEvent(eventId, eventData) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('events')
            .update(eventData)
            .eq('id', eventId);
        if (error) throw error;
        return data;
    },

    async deleteEvent(eventId) {
        const supabase = await initSupabase();
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', eventId);
        if (error) throw error;
        return true;
    }
};

// Database operations for Teams
const teamOperations = {
    async createTeam(teamData) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('teams')
            .insert([teamData]);
        if (error) throw error;
        return data;
    },

    async getTeams() {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('teams')
            .select('*');
        if (error) throw error;
        return data;
    },

    async updateTeam(teamId, teamData) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('teams')
            .update(teamData)
            .eq('id', teamId);
        if (error) throw error;
        return data;
    }
};

// Database operations for User Profiles
const userProfileOperations = {
    async getUserProfile(userId) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    async updateUserProfile(userId, profileData) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert([{ user_id: userId, ...profileData }]);
        if (error) throw error;
        return data;
    }
};

// Database operations for Analytics
const analyticsOperations = {
    async getEventAnalytics(eventId) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('event_analytics')
            .select('*')
            .eq('event_id', eventId);
        if (error) throw error;
        return data;
    },

    async getUserAnalytics(userId) {
        const supabase = await initSupabase();
        const { data, error } = await supabase
            .from('user_analytics')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    }
};

// Export all operations
export {
    initSupabase,
    eventOperations,
    teamOperations,
    userProfileOperations,
    analyticsOperations
};