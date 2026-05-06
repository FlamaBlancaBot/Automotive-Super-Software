import { useState } from 'react';
import { Car, User, Wrench, Calendar, FileText, Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  icon: any;
  description: string;
}

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Vehicle data
    licensePlate: '',
    make: '',
    model: '',
    year: '',
    vin: '',
    mileage: '',

    // Customer data
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',

    // Service data
    serviceType: '',
    estimatedDuration: '0',

    // Booking data
    preferredDate: '',
    arrivalTime: '',
    priority: 'Normal',
    hotelStatus: 'New',

    // Notes
    customerNotes: '',
    officeNotes: '',
  });

  const steps: Step[] = [
    { id: 1, title: 'Vehicle Registration', icon: Car, description: 'Enter vehicle details' },
    { id: 2, title: 'Customer Details', icon: User, description: 'Customer information' },
    { id: 3, title: 'Job Service', icon: Wrench, description: 'Select service type' },
    { id: 4, title: 'Booking Details', icon: Calendar, description: 'Schedule appointment' },
    { id: 5, title: 'Notes & Summary', icon: FileText, description: 'Final review' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="flex gap-8">
      {/* Steps Sidebar */}
      <div className="w-80 bg-[#0f1420] border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-6">Onboarding Steps</h2>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'bg-green-900/30 text-green-300 border border-green-700/30'
                    : 'bg-gray-800/30 text-gray-400 hover:bg-gray-700/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isCurrent ? 'bg-white/20' : isCompleted ? 'bg-green-600' : 'bg-gray-700/50'
                }`}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className={`text-xs ${isCurrent ? 'text-blue-200' : 'text-gray-500'}`}>
                    {step.description}
                  </div>
                </div>
                <div className={`text-xs font-medium ${
                  isCurrent ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {index + 1}/{steps.length}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Progress</div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Step {currentStep} of {steps.length} completed
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1">
        <div className="bg-[#0f1420] border border-gray-800 rounded-xl p-8">
          {/* Step 1: Vehicle Registration */}
          {currentStep === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Vehicle Registration</h2>
                  <p className="text-sm text-gray-400">Enter the vehicle information below</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">License Plate *</label>
                  <input
                    type="text"
                    value={formData.licensePlate}
                    onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                    placeholder="ABC-123"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">VIN</label>
                  <input
                    type="text"
                    value={formData.vin}
                    onChange={(e) => handleInputChange('vin', e.target.value)}
                    placeholder="1HGBH41JXMN109186"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    placeholder="Toyota"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="Camry"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Year</label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => handleInputChange('year', e.target.value)}
                    placeholder="2024"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mileage</label>
                  <input
                    type="text"
                    value={formData.mileage}
                    onChange={(e) => handleInputChange('mileage', e.target.value)}
                    placeholder="50,000 km"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <div className="flex gap-3">
                  <div className="text-blue-400 mt-0.5">ℹ️</div>
                  <div>
                    <div className="text-sm font-medium text-blue-300">Quick lookup available</div>
                    <div className="text-sm text-blue-400/70 mt-1">
                      Enter the license plate to automatically fill in vehicle details from our database
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Customer Details */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Customer Details</h2>
                  <p className="text-sm text-gray-400">Provide customer contact information</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="john.doe@example.com"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Address (Optional)</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Main St, City, State, ZIP"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <button className="flex-1 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all">
                  Check Existing Customer
                </button>
                <button className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-all">
                  Create New Customer
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Job Service */}
          {currentStep === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Job/Service Selection</h2>
                  <p className="text-sm text-gray-400">Choose the service type and details</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Service Type *</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['Oil Change', 'Brake Service', 'Tire Rotation', 'Engine Diagnostics', 'Transmission', 'General Inspection'].map((service) => (
                      <button
                        key={service}
                        onClick={() => handleInputChange('serviceType', service)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.serviceType === service
                            ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-medium">{service}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Estimated Duration (hours)</label>
                    <div className="flex gap-2">
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={formData.estimatedDuration}
                        onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}
                        className="flex-1"
                      />
                      <div className="w-16 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-center">
                        {formData.estimatedDuration}h
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Quick Notes</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Oil change due', 'Brake noise', 'Check engine light', 'Routine maintenance', 'Customer complaint', 'Follow-up service'].map((note) => (
                      <button
                        key={note}
                        className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-700/50 text-sm transition-all"
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Booking Details */}
          {currentStep === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Booking Details</h2>
                  <p className="text-sm text-gray-400">Schedule the appointment</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Preferred Date *</label>
                  <input
                    type="date"
                    value={formData.preferredDate}
                    onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Arrival Time *</label>
                  <input
                    type="time"
                    value={formData.arrivalTime}
                    onChange={(e) => handleInputChange('arrivalTime', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option>Low</option>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Hotel Status</label>
                  <select
                    value={formData.hotelStatus}
                    onChange={(e) => handleInputChange('hotelStatus', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-300">Availability Check</div>
                    <div className="text-sm text-green-400/70 mt-1">
                      Selected time slot is available - booking capacity at 60%
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-all">
                    Check Availability
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Notes & Summary */}
          {currentStep === 5 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Notes & Summary</h2>
                  <p className="text-sm text-gray-400">Review and add final notes</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Customer Notes</label>
                  <textarea
                    value={formData.customerNotes}
                    onChange={(e) => handleInputChange('customerNotes', e.target.value)}
                    placeholder="Enter any notes the customer mentioned..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Office Notes (Internal)</label>
                  <textarea
                    value={formData.officeNotes}
                    onChange={(e) => handleInputChange('officeNotes', e.target.value)}
                    placeholder="Internal notes for the service team..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Booking Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Vehicle</div>
                      <div className="font-medium">{formData.make} {formData.model} {formData.year || ''}</div>
                      <div className="text-gray-500">{formData.licensePlate || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Customer</div>
                      <div className="font-medium">{formData.firstName} {formData.lastName}</div>
                      <div className="text-gray-500">{formData.email || formData.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Service</div>
                      <div className="font-medium">{formData.serviceType || 'Not selected'}</div>
                      <div className="text-gray-500">{formData.estimatedDuration}h estimated</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Appointment</div>
                      <div className="font-medium">{formData.preferredDate || 'Not set'}</div>
                      <div className="text-gray-500">{formData.arrivalTime || 'No time'} - {formData.priority} priority</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-800">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex-1" />

            {currentStep < steps.length ? (
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg transition-all flex items-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                Save Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
