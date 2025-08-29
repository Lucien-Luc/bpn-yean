# Overview

This is a web-based agriculture survey application developed for the BPN Agriculture Survey in partnership with YEAN & Mastercard Foundation. The application consists of a multi-step survey form for collecting agricultural data and an admin dashboard for monitoring submissions and analytics. The system is built with vanilla JavaScript and uses Firebase Firestore as the backend database for real-time data storage and retrieval.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application follows a client-side rendered architecture with vanilla JavaScript modules. The frontend is organized into separate concerns:

- **Survey Interface**: A progressive multi-step form with validation and progress tracking
- **Admin Dashboard**: Real-time analytics dashboard with charts and statistics
- **Responsive Design**: Mobile-first CSS approach using CSS custom properties and Flexbox/Grid layouts

The modular JavaScript structure includes:
- `survey.js`: Main survey application logic and form handling
- `admin.js`: Dashboard functionality with real-time data visualization
- `utils.js`: Shared utility functions for validation, formatting, and animations
- `firebase-config.js`: Database configuration and connection management

## Data Storage
The system uses Firebase Firestore as the primary database with three main collections:
- `survey_submissions`: Stores completed survey responses with metadata
- `survey_activity`: Tracks user interactions and analytics events
- `survey_metadata`: Contains configuration and system data

This NoSQL approach provides real-time synchronization and scalability for the survey data.

## User Experience Design
The application implements a guided survey experience with:
- Progressive disclosure through multi-step forms
- Real-time validation and error handling
- Animated transitions using AOS (Animate On Scroll) library
- Loading states and progress indicators
- SweetAlert2 for user notifications and confirmations

## Analytics and Monitoring
The admin dashboard provides comprehensive analytics through:
- Real-time submission tracking with live updates
- Chart.js integration for data visualization
- Activity logging for user behavior analysis
- Completion rate and time-to-completion metrics

# External Dependencies

## Frontend Libraries
- **Chart.js**: Data visualization library for creating interactive charts in the admin dashboard
- **SweetAlert2**: Enhanced alert and notification system for better user experience
- **AOS (Animate On Scroll)**: Animation library for smooth page transitions and effects
- **Font Awesome**: Icon library for consistent UI iconography

## Firebase Services
- **Firebase Firestore**: Real-time NoSQL database for storing survey submissions and analytics
- **Firebase SDK**: Client-side JavaScript SDK for database connectivity and real-time synchronization

## Development Tools
- **ES6 Modules**: Modern JavaScript module system for code organization
- **CSS Custom Properties**: For consistent theming and design system implementation