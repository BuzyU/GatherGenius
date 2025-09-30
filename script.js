document.addEventListener("DOMContentLoaded", function() {
    const applyFiltersButton = document.getElementById("apply-filters-button");
    const filterButton = document.getElementById("filter-button");
    const filterForm = document.getElementById("filter-form");
    
    filterButton.addEventListener("click", function() {
        filterForm.classList.toggle("hidden");
    });

    applyFiltersButton.addEventListener("click", function(event) {
        event.preventDefault(); // Prevent form submission
        filterEvents();
    });

    function filterEvents() {
        fetch("http://127.0.0.1:5500/events_data.json")
            .then(response => response.json())
            .then(data => {
                const filteredEvents = data.filter(event => {
                    const keyword = filterForm.keyword.value.toLowerCase();
                    const minPrice = parseFloat(filterForm.minPrice.value) || 0;
                    const maxPrice = parseFloat(filterForm.maxPrice.value) || Number.MAX_VALUE;
                    const minTeamSize = parseInt(filterForm.minTeamSize.value) || 0;
                    const maxTeamSize = parseInt(filterForm.maxTeamSize.value) || Number.MAX_VALUE;
                    const certification = filterForm.certification.checked;

                    const nameMatch = event.name.toLowerCase().includes(keyword);
                    const priceMatch = event.ticket_price >= minPrice && event.ticket_price <= maxPrice;
                    const teamSizeMatch = event.team_size >= minTeamSize && event.team_size <= maxTeamSize;
                    const certificationMatch = certification ? event.certification_required : true;

                    return nameMatch && priceMatch && teamSizeMatch && certificationMatch;
                });

                displayEvents(filteredEvents);
            })
            .catch(error => console.error("Error fetching events data:", error));
    }
    function displayEvents(events) {
        const eventsContainer = document.getElementById("events-container");
        eventsContainer.innerHTML = "";
    
        events.forEach(event => {
            const eventDiv = document.createElement("div");
            eventDiv.classList.add("event");
    
            // Event Title (Clickable)
            const eventTitle = document.createElement("h3");
            eventTitle.textContent = event.name;
            eventTitle.style.cursor = "pointer"; // Change cursor to pointer
            eventTitle.addEventListener("click", function() {
                window.location.href = "booking.html"; // Redirect to booking.html
            });
            eventDiv.appendChild(eventTitle);
    
            // Other Event Details
            eventDiv.innerHTML += `
                <p>Date: ${event.date}</p>
                <p>Location: ${event.location}</p>
                <p>Description: ${event.description}</p>
                <p>Ticket Price: $${event.ticket_price}</p>
                <p>Team Size: ${event.team_size}</p>
                <p>Certification Required: ${event.certification_required ? "Yes" : "No"}</p>
            `;
    
            // Book Button
            const bookButton = document.createElement("button");
            bookButton.textContent = "Book";
            bookButton.classList.add("book-button");
            bookButton.addEventListener("click", function() {
                window.location.href = "booking.html"; // Redirect to booking.html
            });
            eventDiv.appendChild(bookButton);
    
            eventsContainer.appendChild(eventDiv);
        });
    }
    
    filterEvents(); // Initially fetch and display all events
});

