// Utility Functions
export class Utils {
    // Format timestamp to readable date
    static formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    }

    // Format duration in minutes
    static formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '0 min';
        
        const minutes = Math.round(milliseconds / (1000 * 60));
        
        if (minutes < 1) return '< 1 min';
        if (minutes < 60) return `${minutes} min`;
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) return `${hours}h`;
        return `${hours}h ${remainingMinutes}m`;
    }

    // Validate form data
    static validateFormData(formData) {
        const errors = [];
        const requiredFields = [
            'interest', 'financial_proposals', 'cash_flow', 'insurance', 
            'record_keeping', 'cooperative', 'supply_chain', 'leadership_training',
            'market_obstacle', 'collab_marketing', 'collab_purchasing', 'collab_supply_chain',
            'collab_transport', 'collab_information', 'export_support', 'yean_activities',
            'market_info_source', 'ideal_customer', 'technical_coaching', 'livestock_challenge',
            'crop_challenge', 'processing_challenge', 'confidence_pests', 'confidence_weather',
            'confidence_postharvest', 'confidence_equipment', 'confidence_contamination',
            'biggest_challenge', 'innovation_barrier', 'business_model', 'yean_innovation_support',
            'sustainability_concern', 'innovative_idea', 'session_feedback'
        ];

        // Check required fields
        requiredFields.forEach(field => {
            if (!formData[field] || formData[field].toString().trim() === '') {
                errors.push(`${field.replace(/_/g, ' ')} is required`);
            }
        });

        // Checkbox group validation disabled - allow any number of selections

        return errors;
    }

    // Sanitize form data
    static sanitizeFormData(formData) {
        const sanitized = { ...formData };
        
        // Trim text fields
        Object.keys(sanitized).forEach(key => {
            if (typeof sanitized[key] === 'string') {
                sanitized[key] = sanitized[key].trim();
            }
        });

        return sanitized;
    }

    // Generate unique ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Show notification
    static showNotification(message, type = 'info') {
        // Using SweetAlert2 for notifications
        const icon = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
        
        Swal.fire({
            icon: icon,
            title: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }

    // Show loading overlay
    static showLoading(message = 'Loading...') {
        Swal.fire({
            title: message,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    // Hide loading overlay
    static hideLoading() {
        Swal.close();
    }

    // Export data to CSV (legacy function - kept for backward compatibility)
    static exportToCSV(data, filename = 'survey_data.csv') {
        return this.exportToExcelCSV(data, filename);
    }

    // Enhanced export function optimized for Excel
    static exportToExcelCSV(data, filename = 'survey_data.csv', headerMap = {}) {
        if (!data || data.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

        // Get column headers in order (if defined) or all unique keys
        const columnHeaders = Object.keys(data[0]);
        
        // Create human-readable headers
        const readableHeaders = columnHeaders.map(key => headerMap[key] || this.getFriendlyFieldName(key));
        
        // Convert data to CSV format with proper Excel formatting
        const csvRows = [];
        
        // Add header row
        csvRows.push(readableHeaders.map(header => this.escapeCsvValue(header)).join(','));
        
        // Add data rows
        data.forEach(item => {
            const row = columnHeaders.map(header => {
                const value = item[header];
                
                if (value === null || value === undefined || value === '') {
                    return '""'; // Empty quoted field for Excel
                }
                
                // Handle arrays (already processed in admin.js)
                if (Array.isArray(value)) {
                    const joinedValue = value.join(' | ');
                    return this.escapeCsvValue(joinedValue);
                }
                
                // Handle objects (like timestamps - should already be processed)
                if (typeof value === 'object') {
                    if (value.toDate) {
                        return this.escapeCsvValue(this.formatTimestamp(value));
                    }
                    return this.escapeCsvValue(JSON.stringify(value));
                }
                
                // Handle strings and numbers
                return this.escapeCsvValue(String(value));
            });
            
            csvRows.push(row.join(','));
        });

        // Create CSV content with UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF'; // UTF-8 BOM
        const csvContent = BOM + csvRows.join('\r\n'); // Use Windows line endings for Excel
        
        // Create and download file with proper MIME type for Excel
        const blob = new Blob([csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up object URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        this.showNotification(`Successfully exported ${data.length} records to ${filename}`, 'success');
    }

    // Helper function to properly escape CSV values for Excel
    static escapeCsvValue(value) {
        if (value === null || value === undefined) {
            return '""';
        }
        
        const stringValue = String(value);
        
        // Always quote if the value contains special characters
        if (stringValue.includes(',') || 
            stringValue.includes('"') || 
            stringValue.includes('\n') || 
            stringValue.includes('\r') ||
            stringValue.includes('|')) {
            // Escape quotes by doubling them and wrap in quotes
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        // For numeric-looking values, quote them to preserve formatting
        if (/^\d+$/.test(stringValue) && stringValue.length > 10) {
            return `"${stringValue}"`;
        }
        
        return stringValue;
    }

    // Calculate completion percentage
    static calculateProgress(currentStep, totalSteps) {
        return Math.round((currentStep / totalSteps) * 100);
    }

    // Get friendly field names for display
    static getFriendlyFieldName(fieldName) {
        const fieldMap = {
            'interest': 'Interest in Support',
            'financial_proposals': 'Financial Proposals Training',
            'cash_flow': 'Cash Flow Management',
            'insurance': 'Agricultural Insurance',
            'record_keeping': 'Record Keeping',
            'cooperative': 'Cooperative Formation',
            'quality_standards': 'Quality Standards',
            'supply_chain': 'Supply Chain Assistance',
            'leadership_training': 'Leadership Training',
            'other_training': 'Other Training Needs',
            'market_obstacle': 'Market Obstacle',
            'collab_marketing': 'Collaboration - Marketing',
            'collab_purchasing': 'Collaboration - Purchasing',
            'collab_supply_chain': 'Collaboration - Supply Chain',
            'collab_transport': 'Collaboration - Transport',
            'collab_information': 'Collaboration - Information',
            'export_support': 'Export Support',
            'yean_activities': 'YEAN Activities',
            'market_info_source': 'Market Information Source',
            'ideal_customer': 'Ideal Customer',
            'technical_coaching': 'Technical Coaching',
            'livestock_challenge': 'Livestock Challenge',
            'crop_challenge': 'Crop Challenge',
            'processing_challenge': 'Processing Challenge',
            'confidence_pests': 'Confidence - Pests',
            'confidence_weather': 'Confidence - Weather',
            'confidence_postharvest': 'Confidence - Post-harvest',
            'confidence_equipment': 'Confidence - Equipment',
            'confidence_contamination': 'Confidence - Contamination',
            'biggest_challenge': 'Biggest Challenge',
            'climate_practices': 'Climate Practices',
            'innovation_barrier': 'Innovation Barrier',
            'business_model': 'Business Model',
            'yean_innovation_support': 'Innovation Support',
            'sustainability_concern': 'Sustainability Concern',
            'innovative_idea': 'Innovative Idea',
            'session_feedback': 'Session Feedback'
        };

        return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Get friendly option values
    static getFriendlyOptionValue(fieldName, value) {
        // Handle array values (checkboxes) - remove duplicates and clean up
        if (Array.isArray(value)) {
            // Remove duplicates and empty values
            const cleanArray = [...new Set(value.filter(v => v && v.trim() !== ''))];
            
            // Limit to reasonable display length for table
            if (cleanArray.length > 3) {
                return cleanArray.slice(0, 3).join(', ') + ` (+${cleanArray.length - 3} more)`;
            }
            
            return cleanArray.join(', ') || 'N/A';
        }

        // Handle scale values
        if (['1', '2', '3', '4', '5'].includes(String(value))) {
            const scaleMap = {
                '1': 'Very Low/Not Confident',
                '2': 'Low/Somewhat Confident',
                '3': 'Medium/Moderately Confident',
                '4': 'High/Confident',
                '5': 'Very High/Very Confident'
            };
            
            if (fieldName.includes('confidence_') || fieldName.includes('collab_')) {
                return `${value} - ${scaleMap[value]}`;
            }
            
            return value;
        }

        // Handle specific field mappings
        const fieldMappings = {
            'interest': {
                'yes': 'Yes',
                'no': 'No', 
                'not_sure': 'Not sure yet'
            },
            'market_obstacle': {
                'connections': 'Lack of connections',
                'quality_volume': 'Quality/Volume requirements',
                'transport_cost': 'High transport costs',
                'competition': 'Competition',
                'branding': 'Branding/Marketing'
            },
            'innovation_barrier': {
                'capital': 'Limited Capital',
                'technical_knowledge': 'Technical Knowledge',
                'market_access': 'Market Access',
                'regulatory': 'Regulatory Issues'
            }
        };

        // Apply field-specific mapping
        if (fieldMappings[fieldName] && fieldMappings[fieldName][value]) {
            return fieldMappings[fieldName][value];
        }

        // Convert snake_case to readable format
        if (typeof value === 'string') {
            return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        return value || 'N/A';
    }
}

// Animation utilities
export class AnimationUtils {
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.opacity = Math.min(progress, 1);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        let start = null;
        const initialOpacity = parseFloat(getComputedStyle(element).opacity) || 1;
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.opacity = initialOpacity * (1 - Math.min(progress, 1));
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }

    static slideUp(element, duration = 300) {
        const height = element.offsetHeight;
        element.style.height = height + 'px';
        element.style.overflow = 'hidden';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.height = (height * (1 - Math.min(progress, 1))) + 'px';
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
                element.style.height = '';
                element.style.overflow = '';
            }
        };
        
        requestAnimationFrame(animate);
    }
}
