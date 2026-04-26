document.addEventListener('DOMContentLoaded', () => {
    // 1. Sticky Navbar Effect
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Scroll Reveal Animations
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 150;

        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    // Trigger once on load
    revealOnScroll();

    // 3. Smooth Scrolling for Navigation Links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 4. Handle form submission (Prevent default for demo)
    const partnershipForm = document.getElementById('partnership-form');
    if (partnershipForm) {
        partnershipForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Thank you for your interest! We will contact you soon.');
            partnershipForm.reset();
        });
    }

    // 5. Mobile Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinksList = document.querySelector('.nav-links');
    
    if (hamburger && navLinksList) {
        hamburger.addEventListener('click', () => {
            navLinksList.classList.toggle('active');
        });
    }
});
