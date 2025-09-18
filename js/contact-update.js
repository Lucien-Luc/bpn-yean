// Contact Information Update Logic
import { db, COLLECTIONS } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { Utils } from './utils.js';

class ContactUpdate {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        console.log('Contact update form initialized');
    }
    
    attachEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Show loading
        this.setLoading(true);
        
        try {
            // Get form data
            const formData = new FormData(this.form);
            const contactData = {
                fullName: formData.get('fullName').trim(),
                companyName: formData.get('companyName').trim(),
                email: formData.get('email').trim(),
                phone: formData.get('phone').trim(),
                interest: formData.get('interest'),
                marketObstacle: formData.get('marketObstacle'),
                businessType: formData.get('businessType') || null
            };
            
            // Validate required fields
            if (!contactData.fullName || !contactData.companyName || !contactData.interest || !contactData.marketObstacle) {
                throw new Error('Please fill in all required fields');
            }
            
            // Try to find matching submission
            const matchingSubmissions = await this.findMatchingSubmissions(contactData);
            
            if (matchingSubmissions.length === 0) {
                // No matching submission found
                await this.handleNoMatch(contactData);
            } else if (matchingSubmissions.length === 1) {
                // Perfect match - update the submission
                await this.updateSubmission(matchingSubmissions[0], contactData);
            } else {
                // Multiple matches - let user choose
                await this.handleMultipleMatches(matchingSubmissions, contactData);
            }
            
        } catch (error) {
            console.error('Error updating contact information:', error);
            await Swal.fire({
                title: 'Error',
                text: error.message || 'Failed to update contact information. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            this.setLoading(false);
        }
    }
    
    async findMatchingSubmissions(contactData) {
        // Query submissions with matching interest and market obstacle
        const submissionsRef = collection(db, COLLECTIONS.SUBMISSIONS);
        const matchQuery = query(
            submissionsRef,
            where('interest', '==', contactData.interest),
            where('market_obstacle', '==', contactData.marketObstacle)
        );
        
        const querySnapshot = await getDocs(matchQuery);
        const matches = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Additional filtering can be done here
            matches.push({
                id: doc.id,
                data: data,
                score: this.calculateMatchScore(data, contactData)
            });
        });
        
        // Sort by match score (highest first)
        return matches.sort((a, b) => b.score - a.score);
    }
    
    calculateMatchScore(submissionData, contactData) {
        let score = 0;
        
        // Base score for required matches
        if (submissionData.interest === contactData.interest) score += 10;
        if (submissionData.market_obstacle === contactData.marketObstacle) score += 10;
        
        // Bonus points for business type match if provided
        if (contactData.businessType && submissionData.business_type === contactData.businessType) {
            score += 5;
        }
        
        // Additional scoring can be added here for other fields
        
        return score;
    }
    
    async updateSubmission(submission, contactData) {
        const submissionRef = doc(db, COLLECTIONS.SUBMISSIONS, submission.id);
        
        const updateData = {
            fullName: contactData.fullName,
            companyName: contactData.companyName,
            email: contactData.email || null,
            phone: contactData.phone || null,
            contactUpdatedAt: serverTimestamp(),
            hasContactInfo: true
        };
        
        await updateDoc(submissionRef, updateData);
        
        // Track this update
        await this.trackUpdate(submission.id, contactData);
        
        await Swal.fire({
            title: 'Success!',
            text: `Thank you, ${contactData.fullName}! Your contact information has been successfully linked to your survey submission.`,
            icon: 'success',
            confirmButtonText: 'Great!',
            confirmButtonColor: '#10b981'
        });
        
        // Optional: Redirect or reset form
        this.form.reset();
    }
    
    async handleNoMatch(contactData) {
        const result = await Swal.fire({
            title: 'No Matching Submission Found',
            html: `
                <p>We couldn't find a survey submission matching your answers:</p>
                <ul style="text-align: left; margin: 1rem 0;">
                    <li><strong>Interest in support:</strong> ${this.formatAnswer(contactData.interest)}</li>
                    <li><strong>Market obstacle:</strong> ${this.formatAnswer(contactData.marketObstacle)}</li>
                </ul>
                <p>Would you like to:</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Take the Full Survey',
            cancelButtonText: 'Try Different Answers',
            confirmButtonColor: '#1e40af',
            cancelButtonColor: '#6b7280'
        });
        
        if (result.isConfirmed) {
            window.location.href = 'index.html';
        } else {
            // Let them try again with different answers
            return;
        }
    }
    
    async handleMultipleMatches(matches, contactData) {
        // Create options for user to choose from
        const options = matches.slice(0, 3).map((match, index) => {
            const date = match.data.submittedAt ? 
                Utils.formatTimestamp(match.data.submittedAt) : 
                'Unknown date';
            
            return `
                <div style="border: 1px solid #e5e7eb; padding: 1rem; margin: 0.5rem 0; border-radius: 8px; text-align: left;">
                    <strong>Submission ${index + 1}</strong><br>
                    <small>Submitted: ${date}</small><br>
                    <small>Match score: ${match.score}/20</small>
                </div>
            `;
        }).join('');
        
        const { value: choice } = await Swal.fire({
            title: 'Multiple Matches Found',
            html: `
                <p>We found ${matches.length} submissions that might be yours. Please select the correct one:</p>
                ${options}
                <p><small>If none of these look right, you can try different answers or contact support.</small></p>
            `,
            input: 'radio',
            inputOptions: {
                '0': 'Submission 1',
                '1': 'Submission 2',
                '2': 'Submission 3'
            },
            confirmButtonText: 'Update This Submission',
            cancelButtonText: 'Cancel',
            showCancelButton: true,
            confirmButtonColor: '#1e40af'
        });
        
        if (choice !== undefined) {
            const selectedMatch = matches[parseInt(choice)];
            await this.updateSubmission(selectedMatch, contactData);
        }
    }
    
    async trackUpdate(submissionId, contactData) {
        try {
            await addDoc(collection(db, COLLECTIONS.ACTIVITY), {
                type: 'contact_updated',
                submissionId: submissionId,
                fullName: contactData.fullName,
                companyName: contactData.companyName,
                updatedAt: serverTimestamp(),
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to track contact update:', error);
            // Don't throw - this is just tracking
        }
    }
    
    formatAnswer(value) {
        const formats = {
            'yes': 'Yes',
            'no': 'No', 
            'not_sure': 'Not sure yet',
            'connections': 'Lack of connections to buyers',
            'quality_volume': 'Quality/Volume requirements',
            'transport_cost': 'High transport costs',
            'competition': 'Competition',
            'branding': 'Branding/Marketing issues'
        };
        
        return formats[value] || value;
    }
    
    setLoading(loading) {
        this.submitBtn.disabled = loading;
        if (loading) {
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        } else {
            this.submitBtn.innerHTML = '<i class="fas fa-check"></i> Update My Information';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Contact update page loaded');
    new ContactUpdate();
});