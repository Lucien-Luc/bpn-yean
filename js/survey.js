// Survey Application Main Logic
import { db, COLLECTIONS } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    doc,
    setDoc,
    getDocs,
    query,
    limit,
    where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { Utils, AnimationUtils } from './utils.js';

class SurveyApp {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 14; // Steps 0-13 (added contact info step)
        this.startTime = Date.now();
        this.formData = {};
        this.surveyId = Utils.generateId();
        
        this.init();
    }

    async init() {
        try {
            // Initialize UI components first
            this.initializeElements();
            this.attachEventListeners();
            this.setupValidation();
            this.updateProgress();
            
            // Hide loading screen and show survey
            this.hideLoadingScreen();
            
            // Show introduction popup after UI is ready
            setTimeout(async () => {
                try {
                    await this.showIntroductionPopup();
                    // Track survey start
                    await this.trackActivity('survey_started');
                } catch (error) {
                    console.error('Error with intro popup or tracking:', error);
                    // Continue anyway - don't block the survey
                }
            }, 500);
            
            console.log('Survey application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize survey:', error);
            // Force show survey even if there are errors
            this.hideLoadingScreen();
            alert('There was an issue loading some features, but you can still use the survey.');
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
        this.headerLogo = document.querySelector('.header-logo');
        
        // Get all survey steps
        this.steps = Array.from(document.querySelectorAll('.survey-step'));
        
        // Initialize triple-click counter for admin access
        this.logoClickCount = 0;
        this.logoClickTimeout = null;
        
        // Initialize checkbox groups with max selection limits
        this.initializeCheckboxGroups();
    }

    attachEventListeners() {
        // Navigation buttons
        this.prevBtn.addEventListener('click', () => this.previousStep());
        this.nextBtn.addEventListener('click', () => this.nextStep());
        this.submitBtn.addEventListener('click', (e) => this.submitSurvey(e));
        this.infoBtn.addEventListener('click', () => this.showIntroductionPopup());
        
        // Triple-click admin access on logo
        if (this.headerLogo) {
            this.headerLogo.addEventListener('click', () => this.handleLogoClick());
        }
        
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

    setupValidation() {
        this.initializeCheckboxGroups();
        this.initializeSliders();
    }

    initializeSliders() {
        const sliders = document.querySelectorAll('.scale-slider');
        
        sliders.forEach(slider => {
            const displayId = slider.id + '_display';
            const display = document.getElementById(displayId);
            
            if (display) {
                // Update display text based on slider type
                const updateDisplay = (value) => {
                    if (slider.name.includes('collab_')) {
                        const labels = ['Not Interested', 'Slightly Interested', 'Neutral', 'Interested', 'Very Interested'];
                        display.textContent = `Interest: ${value} - ${labels[value - 1]}`;
                    } else if (slider.name.includes('confidence_')) {
                        const labels = ['Not Confident', 'Slightly Confident', 'Moderately Confident', 'Confident', 'Very Confident'];
                        display.textContent = `Confidence: ${value} - ${labels[value - 1]}`;
                    } else {
                        const labels = ['Low Priority', 'Below Average Priority', 'Medium Priority', 'Above Average Priority', 'High Priority'];
                        display.textContent = `Priority: ${value} - ${labels[value - 1]}`;
                    }
                };
                
                // Initialize display
                updateDisplay(slider.value);
                
                // Show display on hover or interaction
                slider.addEventListener('mouseenter', () => {
                    display.classList.add('show');
                });
                
                slider.addEventListener('mouseleave', () => {
                    if (!slider.matches(':active')) {
                        display.classList.remove('show');
                    }
                });
                
                slider.addEventListener('input', (e) => {
                    updateDisplay(e.target.value);
                    display.classList.add('show');
                });
                
                slider.addEventListener('change', (e) => {
                    updateDisplay(e.target.value);
                    setTimeout(() => {
                        display.classList.remove('show');
                    }, 2000);
                });
                
                // Show display when focused
                slider.addEventListener('focus', () => {
                    display.classList.add('show');
                });
                
                slider.addEventListener('blur', () => {
                    display.classList.remove('show');
                });
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
        // Checkbox limit enforcement disabled - users can select any number
        const checkboxes = group.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.parentElement.classList.remove('disabled');
            checkbox.disabled = false;
        });
    }

    async showIntroductionPopup() {
        const introText = `
            <div style="text-align: left; line-height: 1.7; font-size: 1.05rem; color: #374151; max-width: 550px; margin: 0 auto;">
                <p style="margin-bottom: 24px; color: #1f2937;">
                    At BPN, we place entrepreneurs at the centre of everything we do. In partnership with the Mastercard Foundation, we are collaborating with YEAN to provide sector-specific support tailored to your needs.
                </p>
                <p style="margin-bottom: 24px; color: #374151;">
                    Following the online info-session held on Tuesday, 19th August, we would like to better understand your individual needs for training and/or technical expertise that YEAN can provide.
                </p>
                <p style="margin-bottom: 0; color: #374151;">
                    We kindly ask you to take a few minutes <strong style="color: #1e40af;">(approximately 12 minutes)</strong> to complete this short survey. Your input will help us design support that is most relevant and impactful for your business.
                </p>
            </div>
        `;

        await Swal.fire({
            title: 'Welcome to the YEAN Follow Up',
            html: introText,
            confirmButtonText: 'Start Survey',
            confirmButtonColor: '#1e40af',
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: 'professional-welcome-popup',
                confirmButton: 'professional-confirm-btn'
            },
            didOpen: (popup) => {
                // Subtle fade-in animation
                popup.style.opacity = '0';
                popup.style.transform = 'translateY(-20px)';
                popup.style.transition = 'all 0.4s ease-out';
                
                setTimeout(() => {
                    popup.style.opacity = '1';
                    popup.style.transform = 'translateY(0)';
                }, 50);
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

    // Admin functionality
    handleLogoClick() {
        this.logoClickCount++;
        
        // Clear existing timeout
        if (this.logoClickTimeout) {
            clearTimeout(this.logoClickTimeout);
        }
        
        // Set timeout to reset click count
        this.logoClickTimeout = setTimeout(() => {
            this.logoClickCount = 0;
        }, 1000); // Reset after 1 second
        
        // Check for triple click
        if (this.logoClickCount === 3) {
            this.logoClickCount = 0;
            clearTimeout(this.logoClickTimeout);
            this.showAdminSignupPopup();
        }
    }

    async showAdminSignupPopup() {
        try {
            // Check if admin already exists
            const adminExists = await this.checkAdminExists();
            
            if (adminExists) {
                // Show login popup instead of refusal
                await this.showAdminLoginPopup();
                return;
            }

            const { value: formValues } = await Swal.fire({
                title: '<div style="color: #1e40af; font-weight: 700; font-size: 1.6rem; margin-bottom: 10px;">Admin Registration</div>',
                html: `
                    <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151;">Username:</label>
                            <input id="admin-username" type="text" placeholder="Enter admin username" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151;">Password:</label>
                            <input id="admin-password" type="password" placeholder="Enter secure password" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 20px;">
                            <p style="margin: 0; color: #1e40af; font-size: 0.9rem; line-height: 1.4;">
                                <i class="fas fa-shield-alt" style="margin-right: 6px;"></i>
                                This will create the single admin account for the system. Choose a strong password as this cannot be changed easily.
                            </p>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                confirmButtonText: 'Create Admin',
                cancelButtonText: 'Cancel',
                showCancelButton: true,
                confirmButtonColor: '#1e40af',
                cancelButtonColor: '#6b7280',
                customClass: {
                    popup: 'professional-admin-popup',
                    confirmButton: 'professional-confirm-btn',
                    cancelButton: 'professional-cancel-btn'
                },
                preConfirm: () => {
                    const username = document.getElementById('admin-username').value;
                    const password = document.getElementById('admin-password').value;
                    
                    if (!username || !password) {
                        Swal.showValidationMessage('Please fill in both username and password');
                        return false;
                    }
                    
                    if (username.length < 3) {
                        Swal.showValidationMessage('Username must be at least 3 characters');
                        return false;
                    }
                    
                    if (password.length < 6) {
                        Swal.showValidationMessage('Password must be at least 6 characters');
                        return false;
                    }
                    
                    return { username, password };
                },
                didOpen: (popup) => {
                    // Add elegant entrance animation
                    popup.style.opacity = '0';
                    popup.style.transform = 'translateY(-30px) scale(0.9)';
                    popup.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    
                    setTimeout(() => {
                        popup.style.opacity = '1';
                        popup.style.transform = 'translateY(0) scale(1)';
                    }, 50);
                }
            });

            if (formValues) {
                await this.createAdmin(formValues.username, formValues.password);
            }

        } catch (error) {
            console.error('Error in admin signup popup:', error);
            await Swal.fire({
                title: 'Error',
                text: 'An error occurred while setting up admin access.',
                icon: 'error',
                confirmButtonColor: '#1e40af'
            });
        }
    }

    async checkAdminExists() {
        try {
            const adminCollection = collection(db, COLLECTIONS.ADMIN);
            const adminQuery = query(adminCollection, limit(1));
            const adminSnapshot = await getDocs(adminQuery);
            
            return !adminSnapshot.empty;
        } catch (error) {
            console.error('Error checking admin existence:', error);
            return false;
        }
    }

    async createAdmin(username, password) {
        try {
            // Show loading
            Swal.fire({
                title: 'Creating Admin...',
                text: 'Please wait while we set up your admin account.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Simple hash function for password (in production, use proper hashing)
            const hashedPassword = await this.hashPassword(password);
            
            // Create admin document
            const adminDoc = {
                username: username,
                password: hashedPassword,
                createdAt: serverTimestamp(),
                isActive: true,
                role: 'admin'
            };

            await addDoc(collection(db, COLLECTIONS.ADMIN), adminDoc);

            await Swal.fire({
                title: 'Admin Created Successfully!',
                text: `Admin account "${username}" has been created successfully.`,
                icon: 'success',
                confirmButtonText: 'Continue',
                confirmButtonColor: '#10b981',
                customClass: {
                    popup: 'professional-admin-popup'
                }
            });

        } catch (error) {
            console.error('Error creating admin:', error);
            await Swal.fire({
                title: 'Creation Failed',
                text: 'Failed to create admin account. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    }

    async showAdminLoginPopup() {
        try {
            const { value: loginValues } = await Swal.fire({
                title: '<div style="color: #1e40af; font-weight: 700; font-size: 1.6rem; margin-bottom: 10px;">Admin Sign In</div>',
                html: `
                    <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151;">Username:</label>
                            <input id="login-username" type="text" placeholder="Enter your username" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151;">Password:</label>
                            <input id="login-password" type="password" placeholder="Enter your password" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'">
                        </div>
                        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 20px;">
                            <p style="margin: 0; color: #1e40af; font-size: 0.9rem; line-height: 1.4;">
                                <i class="fas fa-key" style="margin-right: 6px;"></i>
                                Sign in to access the admin dashboard and view survey submissions.
                            </p>
                        </div>
                    </div>
                `,
                focusConfirm: false,
                confirmButtonText: 'Sign In',
                cancelButtonText: 'Cancel',
                showCancelButton: true,
                confirmButtonColor: '#1e40af',
                cancelButtonColor: '#6b7280',
                customClass: {
                    popup: 'professional-admin-popup',
                    confirmButton: 'professional-confirm-btn',
                    cancelButton: 'professional-cancel-btn'
                },
                preConfirm: () => {
                    const username = document.getElementById('login-username').value;
                    const password = document.getElementById('login-password').value;
                    
                    if (!username || !password) {
                        Swal.showValidationMessage('Please enter both username and password');
                        return false;
                    }
                    
                    return { username, password };
                },
                didOpen: (popup) => {
                    // Add elegant entrance animation
                    popup.style.opacity = '0';
                    popup.style.transform = 'translateY(-30px) scale(0.9)';
                    popup.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    
                    setTimeout(() => {
                        popup.style.opacity = '1';
                        popup.style.transform = 'translateY(0) scale(1)';
                    }, 50);
                    
                    // Focus on username field
                    setTimeout(() => {
                        document.getElementById('login-username').focus();
                    }, 100);
                }
            });

            if (loginValues) {
                await this.validateAdminLogin(loginValues.username, loginValues.password);
            }

        } catch (error) {
            console.error('Error in admin login popup:', error);
            await Swal.fire({
                title: 'Error',
                text: 'An error occurred while attempting to sign in.',
                icon: 'error',
                confirmButtonColor: '#1e40af'
            });
        }
    }

    async validateAdminLogin(username, password) {
        try {
            // Show loading
            Swal.fire({
                title: 'Signing In...',
                text: 'Please wait while we verify your credentials.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Hash the provided password
            const hashedPassword = await this.hashPassword(password);
            
            // Query for admin with matching username
            const adminCollection = collection(db, COLLECTIONS.ADMIN);
            const adminQuery = query(
                adminCollection, 
                where('username', '==', username),
                where('password', '==', hashedPassword),
                where('isActive', '==', true)
            );
            
            const adminSnapshot = await getDocs(adminQuery);

            if (adminSnapshot.empty) {
                await Swal.fire({
                    title: 'Login Failed',
                    text: 'Invalid username or password. Please try again.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
                return false;
            }

            // Successful login
            await Swal.fire({
                title: 'Login Successful!',
                text: 'Welcome back! Redirecting to admin dashboard...',
                icon: 'success',
                confirmButtonText: 'Continue',
                confirmButtonColor: '#10b981',
                timer: 2000,
                timerProgressBar: true,
                customClass: {
                    popup: 'professional-admin-popup'
                }
            });

            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 2000);

            return true;

        } catch (error) {
            console.error('Error validating admin login:', error);
            await Swal.fire({
                title: 'Login Error',
                text: 'An error occurred during login. Please try again.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
            return false;
        }
    }

    // Simple password hashing (in production, use proper server-side hashing)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'bpn_survey_salt'); // Add salt
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Initialize the survey when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing survey...');
    
    // Failsafe: Hide loading screen after 5 seconds maximum
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        const surveyContainer = document.getElementById('surveyContainer');
        
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            console.log('Failsafe: Forcing loading screen to hide');
            loadingScreen.style.display = 'none';
            if (surveyContainer) {
                surveyContainer.style.display = 'block';
            }
        }
    }, 5000);
    
    try {
        new SurveyApp();
    } catch (error) {
        console.error('Error initializing survey app:', error);
        // Force show survey even if initialization fails
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            const surveyContainer = document.getElementById('surveyContainer');
            
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (surveyContainer) surveyContainer.style.display = 'block';
            
            alert('Survey loaded with limited functionality. Some features may not work.');
        }, 1000);
    }
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

