// Admin Dashboard Logic
import { db, COLLECTIONS } from './firebase-config.js';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    onSnapshot,
    getDocs,
    where,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { Utils } from './utils.js';

class AdminDashboard {
    constructor() {
        this.submissions = [];
        this.activities = [];
        this.charts = {};
        this.unsubscribeCallbacks = [];
        this.stats = {
            total: 0,
            today: 0,
            completionRate: 0,
            avgTime: 0
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('Starting admin dashboard initialization...');
            
            this.initializeElements();
            console.log('✅ Elements initialized');
            
            this.attachEventListeners();
            console.log('✅ Event listeners attached');
            
            this.setupRealtimeListeners();
            console.log('✅ Real-time listeners setup');
            
            await this.loadInitialData();
            console.log('✅ Initial data loaded');
            
            this.initializeCharts();
            console.log('✅ Charts initialized');
            
            console.log('🎉 Admin dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize admin dashboard:', error);
            console.error('Error stack:', error.stack);
            
            // Show user-friendly error
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification('Failed to load dashboard data: ' + error.message, 'error');
            } else {
                alert('Failed to load dashboard data: ' + error.message);
            }
        }
    }

    initializeElements() {
        console.log('Initializing DOM elements...');
        
        // Critical elements that must exist
        const requiredElements = [
            { id: 'totalSubmissions', property: 'totalSubmissionsEl' },
            { id: 'todaySubmissions', property: 'todaySubmissionsEl' },
            { id: 'completionRate', property: 'completionRateEl' },
            { id: 'avgTime', property: 'avgTimeEl' },
            { id: 'submissionsTableBody', property: 'submissionsTableBody' },
            { id: 'detailModal', property: 'detailModal' },
            { id: 'modalBody', property: 'modalBody' },
            { id: 'refreshBtn', property: 'refreshBtn' },
            { id: 'exportBtn', property: 'exportBtn' },
            { id: 'viewAllBtn', property: 'viewAllBtn' }
        ];
        
        const missingElements = [];
        
        // Check each required element
        requiredElements.forEach(({ id, property }) => {
            const element = document.getElementById(id);
            if (element) {
                this[property] = element;
                console.log(`✅ Found element: #${id}`);
            } else {
                missingElements.push(id);
                console.error(`❌ Missing element: #${id}`);
            }
        });
        
        // If any critical elements are missing, throw an error
        if (missingElements.length > 0) {
            throw new Error(`Missing critical DOM elements: ${missingElements.join(', ')}. Make sure you're on the admin.html page.`);
        }
        
        console.log('All DOM elements found successfully!');
    }

    attachEventListeners() {
        // Button listeners
        this.refreshBtn.addEventListener('click', () => this.refreshData());
        this.exportBtn.addEventListener('click', () => this.exportData());
        this.viewAllBtn.addEventListener('click', () => this.viewAllSubmissions());
        
        // Modal listeners
        const closeModal = document.querySelector('.close-modal');
        closeModal.addEventListener('click', () => this.closeModal());
        
        this.detailModal.addEventListener('click', (e) => {
            if (e.target === this.detailModal) {
                this.closeModal();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.detailModal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    setupRealtimeListeners() {
        // Listen to submissions
        const submissionsQuery = query(
            collection(db, COLLECTIONS.SUBMISSIONS),
            orderBy('submittedAt', 'desc'),
            limit(50)
        );
        
        const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            const newSubmissions = [];
            const changes = snapshot.docChanges();
            
            snapshot.forEach((doc) => {
                newSubmissions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            this.submissions = newSubmissions;
            this.updateStats();
            this.updateSubmissionsTable();
            this.updateCharts();
            
            // Handle new submissions - just log to console
            changes.forEach((change) => {
                if (change.type === 'added') {
                    console.log('New submission received:', change.doc.data());
                }
            });
        });
        
        this.unsubscribeCallbacks.push(unsubscribeSubmissions);
    }

    async loadInitialData() {
        try {
            // Load submissions for today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayQuery = query(
                collection(db, COLLECTIONS.SUBMISSIONS),
                where('submittedAt', '>=', Timestamp.fromDate(today))
            );
            
            const todaySnapshot = await getDocs(todayQuery);
            this.stats.today = todaySnapshot.size;
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    updateStats() {
        this.stats.total = this.submissions.length;
        
        // Calculate today's submissions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        this.stats.today = this.submissions.filter(submission => {
            if (!submission.submittedAt) return false;
            
            try {
                // Handle both Firestore Timestamp and regular Date objects
                const submissionDate = submission.submittedAt.toDate ? 
                    submission.submittedAt.toDate() : 
                    new Date(submission.submittedAt);
                
                // Check if the date is valid
                if (isNaN(submissionDate.getTime())) return false;
                
                return submissionDate >= today;
            } catch (error) {
                console.warn('Invalid timestamp in submission:', submission.id, error);
                return false;
            }
        }).length;
        
        // Calculate completion rate (assuming some started but didn't finish)
        // For now, we'll assume 100% since we only have completed submissions
        this.stats.completionRate = 100;
        
        // Calculate average completion time
        const completionTimes = this.submissions
            .filter(s => s.completionTime)
            .map(s => s.completionTime);
        
        if (completionTimes.length > 0) {
            const avgMs = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
            this.stats.avgTime = Utils.formatDuration(avgMs);
        } else {
            this.stats.avgTime = '0 min';
        }
        
        // Update UI
        this.totalSubmissionsEl.textContent = this.stats.total;
        this.todaySubmissionsEl.textContent = this.stats.today;
        this.completionRateEl.textContent = `${this.stats.completionRate}%`;
        this.avgTimeEl.textContent = this.stats.avgTime;
    }

    updateSubmissionsTable() {
        if (this.submissions.length === 0) {
            this.submissionsTableBody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">No submissions yet</td>
                </tr>
            `;
            return;
        }
        
        const recentSubmissions = this.submissions.slice(0, 10);
        
        this.submissionsTableBody.innerHTML = recentSubmissions.map(submission => {
            // Clean and process data for display
            const cleanSubmission = this.cleanSubmissionData(submission);
            
            return `
                <tr>
                    <td>${Utils.formatTimestamp(cleanSubmission.submittedAt)}</td>
                    <td>${Utils.getFriendlyOptionValue('interest', cleanSubmission.interest)}</td>
                    <td>${Utils.getFriendlyOptionValue('market_obstacle', cleanSubmission.market_obstacle)}</td>
                    <td>${Utils.getFriendlyOptionValue('innovation_barrier', cleanSubmission.innovation_barrier)}</td>
                    <td>${Utils.formatDuration(cleanSubmission.completionTime)}</td>
                    <td>
                        <button class="view-btn" onclick="adminDashboard.viewSubmission('${submission.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    initializeCharts() {
        this.charts.interest = this.createInterestChart();
        this.charts.training = this.createTrainingChart();
        this.charts.market = this.createMarketChart();
        
        this.updateCharts();
    }


    createInterestChart() {
        const ctx = document.getElementById('interestChart').getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Yes', 'No', 'Not Sure'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createTrainingChart() {
        const ctx = document.getElementById('trainingChart').getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Financial', 'Cash Flow', 'Insurance', 'Records', 'Cooperative'],
                datasets: [{
                    label: 'Average Priority',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: '#60a5fa',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    createMarketChart() {
        const ctx = document.getElementById('marketChart').getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Connections', 'Quality/Volume', 'Transport Cost', 'Competition', 'Branding'],
                datasets: [{
                    label: 'Count',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#1e40af',
                        '#3b82f6',
                        '#60a5fa',
                        '#93c5fd',
                        '#dbeafe'
                    ]
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateCharts() {
        if (this.submissions.length === 0) return;
        
        // Update interest chart
        this.updateInterestChart();
        
        // Update training chart
        this.updateTrainingChart();
        
        // Update market chart
        this.updateMarketChart();
    }


    updateInterestChart() {
        const interestCounts = { yes: 0, no: 0, not_sure: 0 };
        
        this.submissions.forEach(submission => {
            const interest = submission.interest;
            if (interest === 'yes') interestCounts.yes++;
            else if (interest === 'no') interestCounts.no++;
            else if (interest === 'not_sure') interestCounts.not_sure++;
        });
        
        this.charts.interest.data.datasets[0].data = [
            interestCounts.yes,
            interestCounts.no,
            interestCounts.not_sure
        ];
        this.charts.interest.update();
    }

    updateTrainingChart() {
        const trainingFields = ['financial_proposals', 'cash_flow', 'insurance', 'record_keeping', 'cooperative'];
        const averages = trainingFields.map(field => {
            const values = this.submissions
                .filter(s => s[field])
                .map(s => parseInt(s[field]) || 0);
            
            return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });
        
        this.charts.training.data.datasets[0].data = averages;
        this.charts.training.update();
    }

    updateMarketChart() {
        const obstacles = ['connections', 'quality_volume', 'transport_cost', 'competition', 'branding'];
        const counts = obstacles.map(obstacle => {
            return this.submissions.filter(s => s.market_obstacle === obstacle).length;
        });
        
        this.charts.market.data.datasets[0].data = counts;
        this.charts.market.update();
    }


    // Clean submission data by removing duplicates and formatting properly
    cleanSubmissionData(submission) {
        const cleaned = { ...submission };
        
        // Process each field to remove duplicates and clean data
        Object.keys(cleaned).forEach(key => {
            const value = cleaned[key];
            
            // Handle arrays - remove duplicates
            if (Array.isArray(value)) {
                cleaned[key] = [...new Set(value.filter(v => v && v.trim() !== ''))];
            }
            
            // Handle empty or undefined values
            if (value === undefined || value === null || value === '') {
                cleaned[key] = 'N/A';
            }
        });
        
        return cleaned;
    }

    viewSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        if (!submission) return;
        
        // Generate modal content
        const content = this.generateSubmissionDetailHTML(submission);
        this.modalBody.innerHTML = content;
        
        // Show modal
        this.detailModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    generateSubmissionDetailHTML(submission) {
        const sections = [
            {
                title: 'Basic Information',
                fields: ['interest', 'submittedAt', 'completionTime']
            },
            {
                title: 'Training Needs - Financial Areas',
                fields: ['financial_proposals', 'cash_flow', 'insurance', 'record_keeping', 'cooperative']
            },
            {
                title: 'Quality & Standards',
                fields: ['quality_standards', 'supply_chain', 'leadership_training', 'other_training']
            },
            {
                title: 'Market Access',
                fields: ['market_obstacle', 'collab_marketing', 'collab_purchasing', 'collab_supply_chain', 
                        'collab_transport', 'collab_information', 'export_support', 'yean_activities', 
                        'market_info_source', 'ideal_customer']
            },
            {
                title: 'Technical Support',
                fields: ['technical_coaching', 'livestock_challenge', 'crop_challenge', 'processing_challenge',
                        'confidence_pests', 'confidence_weather', 'confidence_postharvest', 
                        'confidence_equipment', 'confidence_contamination', 'biggest_challenge']
            },
            {
                title: 'Sustainability & Innovation',
                fields: ['climate_practices', 'innovation_barrier', 'business_model', 'yean_innovation_support',
                        'sustainability_concern', 'innovative_idea']
            },
            {
                title: 'Feedback',
                fields: ['session_feedback']
            }
        ];
        
        return sections.map(section => {
            const sectionFields = section.fields.filter(field => submission[field] !== undefined);
            
            if (sectionFields.length === 0) return '';
            
            return `
                <div class="detail-group">
                    <h4 style="color: #1e40af; margin-bottom: 15px; font-size: 1.2rem;">${section.title}</h4>
                    ${sectionFields.map(field => {
                        let value = submission[field];
                        
                        // Special formatting for specific fields
                        if (field === 'submittedAt') {
                            value = Utils.formatTimestamp(value);
                        } else if (field === 'completionTime') {
                            value = Utils.formatDuration(value);
                        } else {
                            value = Utils.getFriendlyOptionValue(field, value);
                        }
                        
                        return `
                            <div style="margin-bottom: 12px;">
                                <span class="detail-label">${Utils.getFriendlyFieldName(field)}:</span>
                                <div class="detail-value">${value || 'Not provided'}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }).join('');
    }

    closeModal() {
        this.detailModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async refreshData() {
        try {
            this.refreshBtn.classList.add('loading');
            this.refreshBtn.innerHTML = '<div class="spinner"></div> Refreshing...';
            
            // Force refresh by reloading data
            await this.loadInitialData();
            this.updateStats();
            this.updateSubmissionsTable();
            this.updateCharts();
            
            Utils.showNotification('Data refreshed successfully', 'success');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            Utils.showNotification('Failed to refresh data', 'error');
        } finally {
            this.refreshBtn.classList.remove('loading');
            this.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        }
    }

    exportData() {
        if (this.submissions.length === 0) {
            Utils.showNotification('No data to export', 'warning');
            return;
        }
        
        // Prepare data for export
        const exportData = this.submissions.map(submission => {
            const exportSubmission = { ...submission };
            
            // Format timestamp for CSV
            if (exportSubmission.submittedAt) {
                exportSubmission.submittedAt = Utils.formatTimestamp(exportSubmission.submittedAt);
            }
            
            // Format completion time
            if (exportSubmission.completionTime) {
                exportSubmission.completionTime = Utils.formatDuration(exportSubmission.completionTime);
            }
            
            // Remove system fields
            delete exportSubmission.id;
            delete exportSubmission.userAgent;
            delete exportSubmission.screenResolution;
            
            return exportSubmission;
        });
        
        const filename = `survey_submissions_${new Date().toISOString().split('T')[0]}.csv`;
        Utils.exportToCSV(exportData, filename);
    }

    viewAllSubmissions() {
        // For now, just show a message. In a real app, this might open a new page or expand the table
        Utils.showNotification(`Showing ${Math.min(this.submissions.length, 10)} of ${this.submissions.length} submissions`, 'info');
    }

    destroy() {
        // Clean up listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
    }
}

// Initialize admin dashboard when DOM is loaded
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
    
    // Make it globally available for onclick handlers
    window.adminDashboard = adminDashboard;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (adminDashboard) {
        adminDashboard.destroy();
    }
});

