// Loading state management
class LoadingManager {
    constructor() {
        this.pageLoader = document.querySelector('.page-loading');
        this.eventsContainer = document.getElementById('events-container');
        this.skeletonTemplate = document.getElementById('skeleton-template');
        this.loadMoreBtn = document.getElementById('load-more');
        
        // Initialize loading states
        this.isLoading = false;
        this.pageLoaded = false;
        
        // Bind methods
        this.showPageLoading = this.showPageLoading.bind(this);
        this.hidePageLoading = this.hidePageLoading.bind(this);
        this.showContentLoading = this.showContentLoading.bind(this);
        this.hideContentLoading = this.hideContentLoading.bind(this);
        
        // Initialize
        this.init();
    }
    
    init() {
        // Show page loading on initial load
        this.showPageLoading();
        
        // Hide page loader once content is ready
        window.addEventListener('load', () => {
            this.hidePageLoading();
            this.pageLoaded = true;
        });
        
        // Handle load more button
        if (this.loadMoreBtn) {
            this.loadMoreBtn.addEventListener('click', () => {
                this.loadMoreContent();
            });
        }
    }
    
    showPageLoading() {
        this.pageLoader.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    hidePageLoading() {
        this.pageLoader.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Add fade-in animation to initial content
        this.eventsContainer.querySelectorAll('.event-card').forEach(card => {
            card.classList.add('fade-in');
        });
    }
    
    showContentLoading() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        // Add skeleton loaders
        for (let i = 0; i < 6; i++) {
            const skeleton = this.skeletonTemplate.content.cloneNode(true);
            this.eventsContainer.appendChild(skeleton);
        }
        
        // Disable load more button
        if (this.loadMoreBtn) {
            this.loadMoreBtn.disabled = true;
            this.loadMoreBtn.classList.add('loading');
        }
    }
    
    hideContentLoading() {
        // Remove skeleton loaders
        const skeletons = this.eventsContainer.querySelectorAll('.skeleton');
        skeletons.forEach(skeleton => skeleton.remove());
        
        // Enable load more button
        if (this.loadMoreBtn) {
            this.loadMoreBtn.disabled = false;
            this.loadMoreBtn.classList.remove('loading');
        }
        
        this.isLoading = false;
    }
    
    async loadMoreContent() {
        this.showContentLoading();
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Add new content (replace this with actual data fetching)
            const newEvents = await this.fetchMoreEvents();
            
            // Add fade-in animation to new content
            newEvents.forEach(event => {
                event.classList.add('fade-in');
                this.eventsContainer.appendChild(event);
            });
        } catch (error) {
            console.error('Error loading more content:', error);
        } finally {
            this.hideContentLoading();
        }
    }
    
    // Mock function to generate event cards (replace with actual data fetching)
    async fetchMoreEvents() {
        const events = [];
        // Generate some dummy event cards
        for (let i = 0; i < 6; i++) {
            const eventCard = document.createElement('a');
            eventCard.href = 'booking.html';
            eventCard.className = 'event-card';
            eventCard.innerHTML = `
                <div class="event-image">
                    <img src="https://source.unsplash.com/random/800x600?event=${Math.random()}" alt="Event">
                    <div class="event-date">
                        <span class="date">${Math.floor(Math.random() * 28) + 1}</span>
                        <span class="month">OCT</span>
                    </div>
                </div>
                <div class="event-content">
                    <div class="event-category">Event</div>
                    <h3 class="event-title">Sample Event ${Math.floor(Math.random() * 1000)}</h3>
                    <div class="event-meta">
                        <span class="location">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9z"/>
                                <circle cx="12" cy="9" r="2.5"/>
                            </svg>
                            Sample Location
                        </span>
                        <span class="price">$${Math.floor(Math.random() * 200) + 50}</span>
                    </div>
                    <div class="event-details">
                        <div class="detail">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z"/>
                            </svg>
                            Team: 2-5
                        </div>
                        <div class="detail">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            </svg>
                            Certification Required
                        </div>
                    </div>
                </div>
            `;
            events.push(eventCard);
        }
        return events;
    }
}

// Initialize loading manager
document.addEventListener('DOMContentLoaded', () => {
    window.loadingManager = new LoadingManager();
});