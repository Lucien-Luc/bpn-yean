// Survey Application Main Logic
import { db, COLLECTIONS } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    doc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { Utils, AnimationUtils } from './utils.js';

class SurveyApp {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 13; // Steps 0-12
        this.startTime = Date.now();
        this.formData = {};
        this.surveyId = Utils.generateId();
        
        this.init();
    }

    async init() {
        try {
            // Show introduction popup first
            await this.showIntroductionPopup();
            
            // Initialize UI components
            this.initializeElements();
            this.attachEventListeners();
            this.setupValidation();
            this.updateProgress();
            
            // Hide loading screen and show survey
            this.hideLoadingScreen();
            
            // Track survey start
            await this.trackActivity('survey_started');
            
            console.log('Survey application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize survey:', error);
            Utils.showNotification('Failed to initialize survey. Please refresh the page.', 'error');
        }
    }

    initializeElements() {
        // Cache DOM elements
        this.surveyContainer = document.getElementById('surveyContainer');
        this.loadingScreen = document.getElementById('loadingScreen');
        this.surveyForm = document.getElementById('surveyForm');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        this.infoBtn = document.getElementById('infoBtn');
        
        // Get all survey steps
        this.steps = Array.from(document.querySelectorAll('.survey-step'));
        
        // Initialize checkbox groups with max selection limits
        this.initializeCheckboxGroups();
    }

    attachEventListeners() {
        // Navigation buttons
        this.prevBtn.addEventListener('click', () => this.previousStep());
        this.nextBtn.addEventListener('click', () => this.nextStep());
        this.submitBtn.addEventListener('click', (e) => this.submitSurvey(e));
        this.infoBtn.addEventListener('click', () => this.showIntroductionPopup());
        
        // Form change tracking
        this.surveyForm.addEventListener('change', (e) => this.handleFormChange(e));
        this.surveyForm.addEventListener('input', (e) => this.handleFormInput(e));
        
        // Prevent form submission on Enter
        this.surveyForm.addEventListener('submit', (e) => e.preventDefault());
        
        // Window beforeunload warning
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    initializeCheckboxGroups() {
        const checkboxGroups = document.querySelectorAll('.checkbox-group[data-max-selections]');
        
        checkboxGroups.forEach(group => {
            const maxSelections = parseInt(group.dataset.maxSelections);
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.handleCheckboxGroupLimit(group, maxSelections);
                });
            });
        });
    }

    handleCheckboxGroupLimit(group, maxSelections) {
        const checkboxes = group.querySelectorAll('input[type="checkbox"]');
        const checked = group.querySelectorAll('input[type="checkbox"]:checked');
        
        if (checked.length >= maxSelections) {
            checkboxes.forEach(checkbox => {
                if (!checkbox.checked) {
                    checkbox.parentElement.classList.add('disabled');
                    checkbox.disabled = true;
                }
            });
        } else {
            checkboxes.forEach(checkbox => {
                checkbox.parentElement.classList.remove('disabled');
                checkbox.disabled = false;
            });
        }
    }

    async showIntroductionPopup() {
        const introText = `
            <div style="text-align: left; line-height: 1.8; font-size: 1.1rem;">
                <p style="margin-bottom: 20px;">
                    At BPN, we place entrepreneurs at the centre of everything we do. In partnership with the Mastercard Foundation, we are collaborating with YEAN to provide sector-specific support tailored to your needs.
                </p>
                <p style="margin-bottom: 20px;">
                    Following the online info-session held on Tuesday, 19th August, we would like to better understand your individual needs for training and/or technical expertise that YEAN can provide.
                </p>
                <p style="margin-bottom: 0;">
                    We kindly ask you to take a few minutes (approximately 12 minutes) to complete this short survey. Your input will help us design support that is most relevant and impactful for your business.
                </p>
            </div>
        `;

        await Swal.fire({
            title: 'Welcome to the BPN Agriculture Survey',
            html: introText,
            icon: 'info',
            confirmButtonText: 'Start Survey',
            confirmButtonColor: '#1e40af',
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: 'swal-wide'
            }
        });
    }

    hideLoadingScreen() {
        setTimeout(() => {
            AnimationUtils.fadeOut(this.loadingScreen, 500);
            setTimeout(() => {
                this.surveyContainer.style.display = 'block';
                AnimationUtils.fadeIn(this.surveyContainer, 500);
                
                // Initialize AOS animations
                if (typeof AOS !== 'undefined') {
                    AOS.init({
                        duration: 600,
                        once: true,
                        offset: 100
                    });
                }
            }, 500);
        }, 1000);
    }

    updateProgress() {
        const progress = Utils.calculateProgress(this.currentStep, this.totalSteps - 1);
        const stepNames = [
            'Getting Started', 'Training Needs', 'Quality Standards', 'Supply Chain & Leadership',
            'Market Access', 'Collaboration & Export', 'YEAN Activities', 'Technical Support',
            'Production Challenges', 'Risk Management', 'Sustainability', 'Innovation & Growth', 'Final Feedback'
        ];
        
        this.progressFill.style.width = `${progress}%`;
        this.progressPercent.textContent = `${progress}%`;
        this.progressText.textContent = stepNames[this.currentStep] || 'Complete';
        
        // Update navigation buttons
        this.prevBtn.style.display = this.currentStep > 0 ? 'flex' : 'none';
        this.nextBtn.style.display = this.currentStep < this.totalSteps - 1 ? 'flex' : 'none';
        this.submitBtn.style.display = this.currentStep === this.totalSteps - 1 ? 'flex' : 'none';
    }

    async nextStep() {
        if (!this.validateCurrentStep()) {
            return;
        }
        
        this.saveCurrentStepData();
        
        if (this.currentStep < this.totalSteps - 1) {
            await this.changeStep(this.currentStep + 1);
            await this.trackActivity('step_completed', { step: this.currentStep - 1 });
        }
    }

    async previousStep() {
        if (this.currentStep > 0) {
            await this.changeStep(this.currentStep - 1);
        }
    }

    async changeStep(newStep) {
        const currentStepElement = this.steps[this.currentStep];
        const newStepElement = this.steps[newStep];
        
        if (!newStepElement) return;
        
        // Animate out current step
        currentStepElement.classList.remove('active');
        await new Promise(resolve => {
            AnimationUtils.fadeOut(currentStepElement, 300);
            setTimeout(resolve, 300);
        });
        
        // Update current step
        this.currentStep = newStep;
        this.updateProgress();
        
        // Animate in new step
        newStepElement.classList.add('active');
        AnimationUtils.fadeIn(newStepElement, 300);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Re-initialize AOS for new step
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
        }
    }

    validateCurrentStep() {
        const currentStepElement = this.steps[this.currentStep];
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        const checkboxGroups = currentStepElement.querySelectorAll('.checkbox-group');
        let isValid = true;
        
        // Clear previous errors
        currentStepElement.querySelectorAll('.field-error').forEach(field => {
            field.classList.remove('field-error');
        });
        currentStepElement.querySelectorAll('.error-message').forEach(error => {
            error.remove();
        });
        
        // Validate required fields
        requiredFields.forEach(field => {
            if (field.type === 'radio') {
                const radioGroup = currentStepElement.querySelectorAll(`input[name="${field.name}"]`);
                const checked = Array.from(radioGroup).some(radio => radio.checked);
                
                if (!checked) {
                    this.showFieldError(field.closest('.radio-group') || field.closest('.scale-question'), 'Please select an option');
                    isValid = false;
                }
            } else if (field.type === 'textarea' || field.type === 'text') {
                if (!field.value.trim()) {
                    this.showFieldError(field, 'This field is required');
                    isValid = false;
                }
            }
        });
        
        // Validate checkbox groups
        checkboxGroups.forEach(group => {
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            const checked = Array.from(checkboxes).some(checkbox => checkbox.checked);
            
            if (!checked) {
                this.showFieldError(group, 'Please select at least one option');
                isValid = false;
            }
        });
        
        if (!isValid) {
            Utils.showNotification('Please fill in all required fields', 'error');
            
            // Scroll to first error
            const firstError = currentStepElement.querySelector('.field-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        return isValid;
    }

    showFieldError(element, message) {
        element.classList.add('field-error');
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        // Insert error message
        if (element.classList.contains('radio-group') || element.classList.contains('checkbox-group')) {
            element.parentNode.insertBefore(errorDiv, element.nextSibling);
        } else {
            element.parentNode.insertBefore(errorDiv, element.nextSibling);
        }
    }

    saveCurrentStepData() {
        const currentStepElement = this.steps[this.currentStep];
        const formData = new FormData(this.surveyForm);
        
        // Process form data
        for (let [key, value] of formData.entries()) {
            if (this.formData[key]) {
                // Handle multiple values (checkboxes)
                if (Array.isArray(this.formData[key])) {
                    this.formData[key].push(value);
                } else {
                    this.formData[key] = [this.formData[key], value];
                }
            } else {
                this.formData[key] = value;
            }
        }
        
        // Handle checkboxes specifically
        const checkboxes = currentStepElement.querySelectorAll('input[type="checkbox"]');
        const checkboxGroups = {};
        
        checkboxes.forEach(checkbox => {
            if (!checkboxGroups[checkbox.name]) {
                checkboxGroups[checkbox.name] = [];
            }
            
            if (checkbox.checked) {
                checkboxGroups[checkbox.name].push(checkbox.value);
            }
        });
        
        // Update form data with checkbox arrays
        Object.keys(checkboxGroups).forEach(name => {
            this.formData[name] = checkboxGroups[name];
        });
    }

    handleFormChange(e) {
        // Real-time validation feedback
        if (e.target.classList.contains('field-error')) {
            e.target.classList.remove('field-error');
            
            // Remove error message
            const errorMsg = e.target.parentNode.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        }
        
        // Save data on change
        this.saveCurrentStepData();
    }

    handleFormInput(e) {
        // Handle text input validation
        if (e.target.tagName === 'TEXTAREA' && e.target.hasAttribute('required')) {
            const value = e.target.value.trim();
            
            if (value.length > 0 && e.target.classList.contains('field-error')) {
                e.target.classList.remove('field-error');
                
                const errorMsg = e.target.parentNode.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }
            }
        }
    }

    async submitSurvey(e) {
        e.preventDefault();
        
        if (!this.validateCurrentStep()) {
            return;
        }
        
        try {
            // Show loading
            Utils.showLoading('Submitting your survey...');
            
            // Save final step data
            this.saveCurrentStepData();
            
            // Sanitize and validate data
            const sanitizedData = Utils.sanitizeFormData(this.formData);
            const validationErrors = Utils.validateFormData(sanitizedData);
            
            if (validationErrors.length > 0) {
                Utils.hideLoading();
                Utils.showNotification(`Please fix the following errors: ${validationErrors.join(', ')}`, 'error');
                return;
            }
            
            // Calculate completion time
            const completionTime = Date.now() - this.startTime;
            
            // Prepare submission data
            const submissionData = {
                ...sanitizedData,
                surveyId: this.surveyId,
                submittedAt: serverTimestamp(),
                completionTime: completionTime,
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            
            // Submit to Firestore
            await addDoc(collection(db, COLLECTIONS.SUBMISSIONS), submissionData);
            
            // Track completion
            await this.trackActivity('survey_completed', { 
                completionTime: completionTime,
                surveyId: this.surveyId 
            });
            
            Utils.hideLoading();
            
            // Show success message
            await Swal.fire({
                title: 'Survey Submitted Successfully!',
                html: `
                    <p>Thank you for taking the time to complete our agriculture survey.</p>
                    <p>Your responses will help us design support that is most relevant and impactful for your business.</p>
                    <p style="margin-top: 20px; font-weight: 600; color: #10b981;">
                        Completion time: ${Utils.formatDuration(completionTime)}
                    </p>
                `,
                icon: 'success',
                confirmButtonText: 'Close',
                confirmButtonColor: '#10b981',
                allowOutsideClick: false
            });
            
            // Optionally redirect or reset form
            this.resetSurvey();
            
        } catch (error) {
            console.error('Survey submission failed:', error);
            Utils.hideLoading();
            
            await Swal.fire({
                title: 'Submission Failed',
                text: 'There was an error submitting your survey. Please check your internet connection and try again.',
                icon: 'error',
                confirmButtonText: 'Try Again',
                confirmButtonColor: '#ef4444'
            });
        }
    }

    async trackActivity(activityType, data = {}) {
        try {
            const activityData = {
                type: activityType,
                timestamp: serverTimestamp(),
                surveyId: this.surveyId,
                step: this.currentStep,
                ...data
            };
            
            await addDoc(collection(db, COLLECTIONS.ACTIVITY), activityData);
        } catch (error) {
            console.error('Failed to track activity:', error);
            // Don't show error to user, just log it
        }
    }

    hasUnsavedChanges() {
        return this.currentStep > 0 && Object.keys(this.formData).length > 0;
    }

    resetSurvey() {
        this.currentStep = 0;
        this.formData = {};
        this.surveyId = Utils.generateId();
        this.startTime = Date.now();
        
        // Reset form
        this.surveyForm.reset();
        
        // Reset steps
        this.steps.forEach((step, index) => {
            step.classList.toggle('active', index === 0);
            step.style.display = index === 0 ? 'block' : 'none';
        });
        
        // Reset checkbox groups
        document.querySelectorAll('.checkbox-option').forEach(option => {
            option.classList.remove('disabled');
            option.querySelector('input').disabled = false;
        });
        
        // Clear errors
        document.querySelectorAll('.field-error').forEach(field => {
            field.classList.remove('field-error');
        });
        document.querySelectorAll('.error-message').forEach(error => {
            error.remove();
        });
        
        this.updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize the survey when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SurveyApp();
});

// Add CSS for SweetAlert2 wide popup
const style = document.createElement('style');
style.textContent = `
    .swal-wide {
        width: 600px !important;
        max-width: 90vw !important;
    }
    
    .swal-wide .swal2-html-container {
        text-align: left !important;
        line-height: 1.8 !important;
    }
`;
document.head.appendChild(style);

