import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import EmptyState from '../components/EmptyState'
import VehicleHeader from '../components/VehicleHeader'
import Calendar from './Calendar'

function sanitiseRegInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .slice(0, 9)
}

function coerceRegString(input) {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object') {
    if (typeof input.registration === 'string') return input.registration
    if (input.target && typeof input.target.value === 'string') return input.target.value
  }
  return ''
}

function normaliseReg(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/\s/g, '')
    .trim()
}

function sanitisePhoneInput(raw) {
  return String(raw || '').replace(/[^\d +]/g, '').slice(0, 20)
}

function isLikelyPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10
}

function motWindowMessage(motExpiryRaw, selectedDateRaw) {
  if (!motExpiryRaw || !selectedDateRaw) return ''
  const expiry = new Date(motExpiryRaw)
  const selected = new Date(selectedDateRaw)
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(selected.getTime())) return ''
  if (expiry.getTime() < Date.now()) {
    return 'MOT appears expired. Vehicle may only be driven to a pre-booked MOT or repairs, subject to legal conditions.'
  }
  const earliest = new Date(expiry)
  earliest.setMonth(earliest.getMonth() - 1)
  earliest.setDate(earliest.getDate() + 1)
  if (selected < earliest) {
    return 'This MOT can be done, but it may change the renewal date because it is earlier than one month minus a day before expiry.'
  }
  return 'This test is within the early renewal window and should keep the existing renewal date if it passes.'
}

const DEFAULT_REMINDER_OFFSETS = [-30, -15, -5]

const STEPS = [
  { id: 1, title: 'Vehicle Registration', subtitle: 'Enter the vehicle information below' },
  { id: 2, title: 'Customer Details', subtitle: 'Provide customer contact information' },
  { id: 3, title: 'Job Service', subtitle: 'Choose the service type and details' },
  { id: 4, title: 'Booking Details', subtitle: 'Schedule the appointment' },
  { id: 5, title: 'Notes & Summary', subtitle: 'Review and add final notes' },
]

export default function NewIntake({ locationPath, onOpenQuote, onViewJob, onStartAnother }) {
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1 — vehicle lookup
  const [regInput, setRegInput] = useState('')
  const regNormalised = useMemo(() => normaliseReg(regInput), [regInput])
  const [vehicleLookupStatus, setVehicleLookupStatus] = useState('idle')
  const [vehicleMessage, setVehicleMessage] = useState('')
  const [vehicle, setVehicle] = useState(null)
  const [vehicleCustomers, setVehicleCustomers] = useState([])
  const [vehicleSource, setVehicleSource] = useState('database')
  const [vehicleLastChecked, setVehicleLastChecked] = useState('')
  const [vehicleMot, setVehicleMot] = useState(null)
  const [manualVehicle, setManualVehicle] = useState({
    make: '',
    model: '',
    year: '',
    fuel_type: '',
    engine_size: '',
    colour: '',
  })

  // Step 2 — customer details and customer match
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [address, setAddress] = useState('')
  const [sendDetailsBySms, setSendDetailsBySms] = useState(false)
  const [customerDetailsLink, setCustomerDetailsLink] = useState('')
  const [customerCheckStatus, setCustomerCheckStatus] = useState('idle')
  const [customerMatches, setCustomerMatches] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerMessage, setCustomerMessage] = useState('')

  // Step 3 — service selection (loaded from backend)
  const [servicesStatus, setServicesStatus] = useState('loading')
  const [servicesError, setServicesError] = useState('')
  const [serviceTemplates, setServiceTemplates] = useState([])
  const [serviceTemplateId, setServiceTemplateId] = useState('')
  const [customServiceTitle, setCustomServiceTitle] = useState('')
  const selectedService = useMemo(() => {
    const id = Number(serviceTemplateId)
    return serviceTemplates.find((s) => s.id === id) || null
  }, [serviceTemplateId, serviceTemplates])

  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(60)
  const [estimatedDays, setEstimatedDays] = useState(0)
  const [estimatedHours, setEstimatedHours] = useState(1)
  const [durationOverridden, setDurationOverridden] = useState(false)

  // Step 4 — booking details
  const [requestedDate, setRequestedDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [priority, setPriority] = useState('normal')
  const [initialStatus, setInitialStatus] = useState('new')

  const [availabilityStatus, setAvailabilityStatus] = useState('idle')
  const [availabilityResult, setAvailabilityResult] = useState(null)
  const [availabilityError, setAvailabilityError] = useState('')

  const [showingCalendarModal, setShowingCalendarModal] = useState(false)

  // MOT booking extras (only when is_mot)
  const motSelected = Boolean(selectedService && selectedService.is_mot)
  const [motTime, setMotTime] = useState('')
  const [motSupplierName, setMotSupplierName] = useState('')
  const [motSupplierContact, setMotSupplierContact] = useState('')
  const [motIsExternal, setMotIsExternal] = useState(false)
  const [reminderOffsetsEnabled, setReminderOffsetsEnabled] = useState(() => {
    const state = {}
    for (const off of DEFAULT_REMINDER_OFFSETS) state[off] = true
    return state
  })

  // Step 5 — notes and save
  const [notesCustomerWords, setNotesCustomerWords] = useState('')
  const [notesInternal, setNotesInternal] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState('')
  const [saveResult, setSaveResult] = useState(null)

  // Load service templates on page load.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setServicesStatus('loading')
      setServicesError('')
      try {
        const data = await apiGet('/api/service-templates')
        if (cancelled) return
        setServiceTemplates(data.service_templates || [])
        setServicesStatus('ready')
      } catch (err) {
        if (cancelled) return
        setServicesStatus('error')
        setServicesError(
          `Could not load services. The backend returned an error. Database setup may be required (open Set-up). (${err.message})`,
        )
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const q = String(locationPath || '').split('?')[1] || ''
    const params = new URLSearchParams(q)
    const regParam = params.get('reg')
    if (!regParam) return
    if (regInput) return
    const next = sanitiseRegInput(regParam)
    if (!next) return
    setRegInput(next)
    onLookupVehicle(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationPath])

  useEffect(() => {
    if (!requestedDate) {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      setRequestedDate(`${y}-${m}-${d}`)
    }
    if (!arrivalTime) {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setArrivalTime(`${hh}:${mm}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When a service is selected, adopt its default duration (unless user has overridden).
  useEffect(() => {
    if (!selectedService) return
    if (durationOverridden) return
    const next = Number(selectedService.default_duration_minutes || 60)
    setEstimatedDurationMinutes(next)
    const days = Math.floor(next / (8 * 60))
    const rem = next - days * 8 * 60
    const hours = Math.max(1, Math.round(rem / 60))
    setEstimatedDays(days)
    setEstimatedHours(hours)
  }, [selectedService, durationOverridden])

  useEffect(() => {
    const mins = Math.max(0, Number(estimatedDays || 0)) * 8 * 60 + Math.max(0, Number(estimatedHours || 0)) * 60
    setEstimatedDurationMinutes(mins || 60)
  }, [estimatedDays, estimatedHours])

  function clearVehicle() {
    setVehicle(null)
    setVehicleCustomers([])
    setVehicleSource('database')
    setVehicleLastChecked('')
    setVehicleMot(null)
  }

  async function onLookupVehicle(lookupReg = regInput) {
    setSaveStatus('idle')
    setSaveError('')
    setSaveResult(null)

    setVehicleLookupStatus('loading')
    setVehicleMessage('')
    clearVehicle()

    const regToLookup = sanitiseRegInput(coerceRegString(lookupReg) || regInput)
    const regPath = normaliseReg(regToLookup)
    if (!regPath) {
      setVehicleLookupStatus('error')
      setVehicleMessage('Enter a valid registration before lookup.')
      return
    }

    try {
      const data = await apiGet(
        `/api/vehicles/${encodeURIComponent(regPath)}/matches`,
      )
      if (data.found) {
        setVehicleLookupStatus('found')
        setVehicle(data.vehicle)
        setVehicleCustomers(data.customers || [])
        setVehicleSource(String(data.source || 'database'))
        setVehicleLastChecked(data.vehicle?.last_lookup_at || '')
        setVehicleMot(data.mot || null)
        setVehicleMessage('')
      } else {
        setVehicleLookupStatus('not_found')
        const msg =
          data.message ||
          'Vehicle not found in the database. DVLA/DVSA lookup will run through the configured vehicle lookup webhook.'
        const hint = data.hint ? `\n\nHint: ${data.hint}` : ''
        setVehicleMessage(`${msg}${hint}`)
      }
    } catch (err) {
      setVehicleLookupStatus('error')
      setVehicleMessage('Vehicle lookup failed. Check the vehicle lookup webhook or add the vehicle manually.')
    }
  }

  async function onRefreshVehicleData() {
    if (!regNormalised) return
    setVehicleLookupStatus('loading')
    setVehicleMessage('')
    try {
      const data = await apiPost(`/api/vehicles/${encodeURIComponent(regNormalised)}/refresh`, {})
      if (data?.ok && data.vehicle) {
        setVehicle(data.vehicle)
        setVehicleSource(String(data.source || 'webhook'))
        setVehicleLastChecked(data.vehicle?.last_lookup_at || '')
        setVehicleLookupStatus('found')
        setVehicleMessage('Vehicle data refreshed from webhook.')
      } else {
        setVehicleLookupStatus('error')
        setVehicleMessage('Vehicle lookup failed. Check the vehicle lookup webhook or add the vehicle manually.')
      }
    } catch {
      setVehicleLookupStatus('error')
      setVehicleMessage('Vehicle lookup failed. Check the vehicle lookup webhook or add the vehicle manually.')
    }
  }

  function clearCustomerSelection(reason) {
    setSelectedCustomer(null)
    if (reason) setCustomerMessage(reason)
  }

  function onChangeFirstName(v) {
    setFirstName(v)
    if (selectedCustomer) clearCustomerSelection('Customer selection cleared (details changed).')
  }
  function onChangeSurname(v) {
    setSurname(v)
    if (selectedCustomer) clearCustomerSelection('Customer selection cleared (details changed).')
  }
  function onChangePhone(v) {
    setPhoneNumber(v)
    if (selectedCustomer) clearCustomerSelection('Customer selection cleared (details changed).')
  }

  async function onCheckCustomer() {
    setSaveStatus('idle')
    setSaveError('')
    setSaveResult(null)

    setCustomerCheckStatus('loading')
    setCustomerMessage('')
    setCustomerMatches([])
    setSelectedCustomer(null)

    const q =
      (phoneNumber && phoneNumber.trim()) ||
      `${firstName} ${surname}`.trim()

    if (!q) {
      setCustomerCheckStatus('done')
      setCustomerMessage('Enter customer details, then click "Check customer".')
      return
    }

    try {
      const data = await apiGet(`/api/customers/search?q=${encodeURIComponent(q)}`)
      const matches = data.customers || []
      setCustomerMatches(matches)
      setCustomerCheckStatus('done')
      if (matches.length === 0) {
        setCustomerMessage('No match found. Create new customer.')
      } else {
        setCustomerMessage('Select an existing customer, or continue as a new customer.')
      }
    } catch (err) {
      setCustomerCheckStatus('error')
      setCustomerMessage(
        `Customer search failed. The backend returned an error. Database setup may be required (open Set-up). (${err.message})`,
      )
    }
  }

  function onSelectExistingCustomer(customer) {
    setSelectedCustomer(customer)
    setFirstName(customer.first_name || '')
    setSurname(customer.surname || '')
    setPhoneNumber(customer.phone || '')
    setCustomerMessage('Selected existing customer.')
  }

  const association = useMemo(() => {
    const currentOwner = (vehicleCustomers || []).find((c) => c.is_current_owner)

    if (vehicle && selectedCustomer) {
      if (currentOwner && currentOwner.id === selectedCustomer.id) {
        return {
          type: 'known_vehicle_known_customer',
          title: 'Known vehicle and known customer',
          text: 'This vehicle is already linked to the selected customer (current keeper).',
        }
      }
      return {
        type: 'known_vehicle_new_owner',
        title: 'Known vehicle but new owner',
        text: 'This vehicle is linked to a different customer. Saving will set the selected customer as the current keeper.',
      }
    }

    if (vehicle && !selectedCustomer) {
      return {
        type: 'known_vehicle_no_customer',
        title: 'Known vehicle',
        text: 'Choose an existing customer or create a new customer before saving.',
      }
    }

    if (!vehicle && selectedCustomer) {
      return {
        type: 'known_customer_new_vehicle',
        title: 'Existing customer with new vehicle',
        text: 'Vehicle is not in the database yet. Saving will create it and link it to the selected customer.',
      }
    }

    if (!vehicle && !selectedCustomer) {
      return {
        type: 'new_customer_new_vehicle',
        title: 'New customer and new vehicle',
        text: 'Saving will create a new customer, create the vehicle, and link them together.',
      }
    }

    return null
  }, [vehicle, vehicleCustomers, selectedCustomer])

  const requiredMissing = useMemo(() => {
    const missing = []
    if (!regNormalised) missing.push('Registration (REG)')
    if (!String(firstName).trim()) missing.push('First name')
    if (!String(surname).trim()) missing.push('Surname')
    if (!String(phoneNumber).trim()) missing.push('Phone number')
    else if (!isLikelyPhoneNumber(phoneNumber)) missing.push('Valid phone number')
    if (!selectedService) missing.push('Service')
    return missing
  }, [firstName, surname, phoneNumber, regNormalised, selectedService])

  const canSave = requiredMissing.length === 0 && saveStatus !== 'saving'
  const motRenewalMessage = useMemo(
    () => (motSelected ? motWindowMessage(vehicle?.mot_expiry, requestedDate) : ''),
    [motSelected, vehicle, requestedDate],
  )

  async function onCheckAvailability() {
    setAvailabilityStatus('loading')
    setAvailabilityError('')
    setAvailabilityResult(null)

    if (!requestedDate || !arrivalTime || !estimatedDurationMinutes) {
      setAvailabilityStatus('error')
      setAvailabilityError('Enter date, arrival time, and duration first.')
      return
    }

    try {
      const qs = new URLSearchParams({
        requested_date: requestedDate,
        arrival_time: arrivalTime,
        duration_minutes: String(estimatedDurationMinutes),
        priority,
      })
      const data = await apiGet(`/api/availability/suggest?${qs.toString()}`)
      setAvailabilityStatus('done')
      setAvailabilityResult(data)
    } catch (err) {
      setAvailabilityStatus('error')
      setAvailabilityError(err.message)
    }
  }

  function onOpenCalendar() {
    setShowingCalendarModal(true)
  }

  async function onSaveIntake() {
    setSaveStatus('saving')
    setSaveError('')
    setSaveResult(null)
    setCustomerDetailsLink('')

    const reminderOffsets = DEFAULT_REMINDER_OFFSETS.filter(
      (off) => reminderOffsetsEnabled[off],
    )

    try {
      const payload = {
        customer: {
          id: selectedCustomer ? selectedCustomer.id : undefined,
          first_name: firstName,
          surname,
          phone: phoneNumber,
          email,
          postcode,
          address,
        },
        title:
          selectedService &&
          String(selectedService.name || '').trim().toLowerCase() === 'other' &&
          String(customServiceTitle || '').trim()
            ? customServiceTitle
            : null,
        vehicle: {
          registration: regInput,
          ...manualVehicle,
        },
        service_template_id: selectedService.id,
        booking: {
          requested_date: requestedDate || null,
          arrival_time: arrivalTime || null,
          priority,
          status: initialStatus,
          estimated_duration_minutes: Number(estimatedDurationMinutes || 0) || null,
          duration_margin_minutes: 15,
          mot: motSelected
            ? {
                supplier_name: motSupplierName || null,
                supplier_contact: motSupplierContact || null,
                time: motTime || null,
                is_external: motIsExternal,
              }
            : null,
        },
        notes: {
          customer_words: notesCustomerWords || null,
          internal: notesInternal || null,
        },
        reminders: motSelected && motIsExternal ? { offset_minutes: reminderOffsets } : null,
      }

      const data = await apiPost('/api/intake', payload)
      setSaveStatus('saved')
      setSaveResult(data.job)
      setSaveError('')

      if (sendDetailsBySms && data?.job?.id) {
        const detailsReq = await apiPost('/api/customer-detail-requests', {
          customer_id: data.job.customer_id || null,
          job_id: data.job.id,
          base_url: window.location.origin,
          requested_fields: ['email', 'postcode', 'address'],
        }).catch(() => null)
        if (detailsReq?.preview_url) setCustomerDetailsLink(detailsReq.preview_url)
      }
    } catch (err) {
      setSaveStatus('error')
      setSaveError(
        `Save failed. The backend returned an error. Database setup may be required (open Set-up). (${err.message})`,
      )
    }
  }

  async function onCreateQuoteNow() {
    if (!saveResult || !saveResult.id) return
    setSaveError('')
    try {
      const data = await apiPost(`/api/jobs/${saveResult.id}/quotes`, {})
      if (data && data.quote && data.quote.id && onOpenQuote) {
        onOpenQuote(data.quote.id)
      }
    } catch (err) {
      setSaveError(
        err.message ||
          'Failed to create/open quote. The backend returned an error.',
      )
    }
  }

  function resetForAnother() {
    setCurrentStep(1)
    setRegInput('')
    setVehicleLookupStatus('idle')
    setVehicleMessage('')
    setVehicle(null)
    setVehicleCustomers([])

    setFirstName('')
    setSurname('')
    setPhoneNumber('')
    setEmail('')
    setPostcode('')
    setAddress('')
    setSendDetailsBySms(false)
    setCustomerDetailsLink('')
    setCustomerCheckStatus('idle')
    setCustomerMatches([])
    setSelectedCustomer(null)
    setCustomerMessage('')

    setServiceTemplateId('')
    setEstimatedDurationMinutes(60)
    setDurationOverridden(false)

    setRequestedDate('')
    setArrivalTime('')
    setPriority('normal')
    setInitialStatus('new')

    setAvailabilityStatus('idle')
    setAvailabilityResult(null)
    setAvailabilityError('')

    setMotTime('')
    setMotSupplierName('')
    setMotSupplierContact('')
    setMotIsExternal(false)
    setReminderOffsetsEnabled(() => {
      const state = {}
      for (const off of DEFAULT_REMINDER_OFFSETS) state[off] = true
      return state
    })

    setNotesCustomerWords('')
    setNotesInternal('')
    setSaveStatus('idle')
    setSaveError('')
    setSaveResult(null)

    if (onStartAnother) onStartAnother()
  }

  const canGoNext = currentStep < STEPS.length
  const canGoPrev = currentStep > 1

  return (
    <div className="intakeWizard">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Onboarding</h2>
          <p className="pageSubtitle">
            Intake workflow (database-backed). Vehicle lookups may also use the configured webhook when not found locally.
          </p>
        </div>
        <span className="setupPill" title="Early preview">
          Early preview
        </span>
      </header>

      <div className="intakeWizardContainer">
        {/* Left sidebar: Step indicators */}
        <aside className="intakeWizardSidebar">
          <h3 className="intakeSidebarTitle">Onboarding Steps</h3>
          <div className="intakeStepsList">
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id
              const isActive = currentStep === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`intakeStepButton ${isActive ? 'active' : isCompleted ? 'completed' : 'inactive'}`}
                  onClick={() => setCurrentStep(step.id)}
                >
                  <div className="intakeStepIcon">
                    {isCompleted ? '✓' : step.id}
                  </div>
                  <div className="intakeStepContent">
                    <div className="intakeStepTitle">{step.title}</div>
                    <div className="intakeStepSubtitle">{step.subtitle}</div>
                  </div>
                  <div className="intakeStepNumber">{step.id}/5</div>
                </button>
              )
            })}
          </div>

          <div className="intakeProgress">
            <div className="intakeProgressLabel">Progress</div>
            <div className="intakeProgressBar">
              <div
                className="intakeProgressFill"
                style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="intakeProgressText">Step {currentStep} of {STEPS.length} completed</div>
          </div>
        </aside>

        {/* Right panel: Active step content */}
        <main className="intakeWizardContent">
          {currentStep === 1 && (
            <StepVehicle
              regInput={regInput}
              setRegInput={setRegInput}
              regNormalised={regNormalised}
              vehicleLookupStatus={vehicleLookupStatus}
              vehicleMessage={vehicleMessage}
              onLookupVehicle={onLookupVehicle}
              onRefreshVehicleData={onRefreshVehicleData}
              vehicle={vehicle}
              vehicleSource={vehicleSource}
              vehicleLastChecked={vehicleLastChecked}
              vehicleMot={vehicleMot}
              manualVehicle={manualVehicle}
              setManualVehicle={setManualVehicle}
            />
          )}

          {currentStep === 2 && (
            <StepCustomer
              firstName={firstName}
              surname={surname}
              phoneNumber={phoneNumber}
              email={email}
              postcode={postcode}
              address={address}
              sendDetailsBySms={sendDetailsBySms}
              setSendDetailsBySms={setSendDetailsBySms}
              onChangeFirstName={onChangeFirstName}
              onChangeSurname={onChangeSurname}
              onChangePhone={onChangePhone}
              setEmail={setEmail}
              setPostcode={setPostcode}
              setAddress={setAddress}
              onCheckCustomer={onCheckCustomer}
              customerCheckStatus={customerCheckStatus}
              customerMessage={customerMessage}
              vehicleCustomers={vehicleCustomers}
              onSelectExistingCustomer={onSelectExistingCustomer}
              selectedCustomer={selectedCustomer}
              customerMatches={customerMatches}
              association={association}
            />
          )}

          {currentStep === 3 && (
            <StepService
              servicesStatus={servicesStatus}
              servicesError={servicesError}
              serviceTemplateId={serviceTemplateId}
              setServiceTemplateId={setServiceTemplateId}
              setDurationOverridden={setDurationOverridden}
              serviceTemplates={serviceTemplates}
              selectedService={selectedService}
              estimatedDays={estimatedDays}
              setEstimatedDays={setEstimatedDays}
              estimatedHours={estimatedHours}
              setEstimatedHours={setEstimatedHours}
              setDurationOverridden={setDurationOverridden}
              customServiceTitle={customServiceTitle}
              setCustomServiceTitle={setCustomServiceTitle}
            />
          )}

          {currentStep === 4 && (
            <StepBooking
              requestedDate={requestedDate}
              setRequestedDate={setRequestedDate}
              arrivalTime={arrivalTime}
              setArrivalTime={setArrivalTime}
              priority={priority}
              setPriority={setPriority}
              initialStatus={initialStatus}
              setInitialStatus={setInitialStatus}
              onCheckAvailability={onCheckAvailability}
              availabilityStatus={availabilityStatus}
              availabilityError={availabilityError}
              availabilityResult={availabilityResult}
              onOpenCalendar={onOpenCalendar}
              motSelected={motSelected}
              motRenewalMessage={motRenewalMessage}
              motTime={motTime}
              setMotTime={setMotTime}
              motSupplierName={motSupplierName}
              setMotSupplierName={setMotSupplierName}
              motSupplierContact={motSupplierContact}
              setMotSupplierContact={setMotSupplierContact}
              motIsExternal={motIsExternal}
              setMotIsExternal={setMotIsExternal}
              reminderOffsetsEnabled={reminderOffsetsEnabled}
              setReminderOffsetsEnabled={setReminderOffsetsEnabled}
            />
          )}

          {currentStep === 5 && (
            <StepNotes
              notesCustomerWords={notesCustomerWords}
              setNotesCustomerWords={setNotesCustomerWords}
              notesInternal={notesInternal}
              setNotesInternal={setNotesInternal}
              regNormalised={regNormalised}
              firstName={firstName}
              surname={surname}
              phoneNumber={phoneNumber}
              selectedCustomer={selectedCustomer}
              selectedService={selectedService}
              requestedDate={requestedDate}
              arrivalTime={arrivalTime}
              requiredMissing={requiredMissing}
              canSave={canSave}
              saveStatus={saveStatus}
              onSaveIntake={onSaveIntake}
              saveError={saveError}
              saveResult={saveResult}
              customerDetailsLink={customerDetailsLink}
              onCreateQuoteNow={onCreateQuoteNow}
              resetForAnother={resetForAnother}
              onViewJob={onViewJob}
            />
          )}

          {/* Navigation buttons */}
          <div className="intakeNavigation">
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={!canGoPrev}
            >
              ← Previous
            </button>
            {currentStep < STEPS.length ? (
              <button
                type="button"
                className="primaryButton"
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Continue →
              </button>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

function StepVehicle({ regInput, setRegInput, regNormalised, vehicleLookupStatus, vehicleMessage, onLookupVehicle, onRefreshVehicleData, vehicle, vehicleSource, vehicleLastChecked, vehicleMot, manualVehicle, setManualVehicle }) {
  return (
    <div className="intakeStepContent">
      <div className="intakeStepHeader">
        <div className="intakeStepIcon">🚗</div>
        <div>
          <h2 className="intakeStepTitle">Vehicle Registration</h2>
          <p className="intakeStepSubtitle">Enter the vehicle information below</p>
        </div>
      </div>

      <div className="intakeRow">
        <div className="plateWrap">
          <label className="fieldLabel" htmlFor="reg">
            Registration (REG)
          </label>
          <div className="plate">
            <span className="plateUk" aria-hidden="true">
              UK
            </span>
            <input
              id="reg"
              className="plateInput"
              value={regInput}
              onChange={(e) => setRegInput(sanitiseRegInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLookupVehicle()
              }}
              placeholder="AB12 CDE"
              autoComplete="off"
              inputMode="text"
              maxLength={9}
            />
          </div>
          <div className="fieldHint">
            Registration matching ignores spaces and case.
          </div>
        </div>

        <div className="intakeActions">
          <button
            type="button"
            className="primaryButton"
            onClick={() => onLookupVehicle()}
            disabled={!regNormalised || vehicleLookupStatus === 'loading'}
          >
            {vehicleLookupStatus === 'loading' ? 'Looking up…' : 'Lookup vehicle'}
          </button>
          <div className="fieldHint">
            If not found: DVLA/DVSA lookup will run through the configured vehicle lookup webhook.
          </div>
          <button
            type="button"
            className="secondaryButton"
            onClick={onRefreshVehicleData}
            disabled={!vehicle || vehicleLookupStatus === 'loading'}
          >
            Refresh vehicle data
          </button>
        </div>

        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Vehicle summary</h3>
            <div className="fieldHint">
              Source: {vehicleSource || 'database'}{vehicleLastChecked ? ` · Last checked ${new Date(vehicleLastChecked).toLocaleString('en-GB')}` : ''}
            </div>
          </div>
          {!vehicle ? (
            <div className="emptyState" style={{ marginTop: 10 }}>Look up a registration to load vehicle details.</div>
          ) : (
            <div className="summaryGrid" style={{ marginTop: 10 }}>
              <SummaryItem label="Make" value={vehicle.make} />
              <SummaryItem label="Model" value={vehicle.model} />
              <SummaryItem label="MOT status" value={vehicle.mot_status} />
              <SummaryItem label="MOT expiry" value={vehicle.mot_expiry} />
            </div>
          )}
        </div>
      </div>

      {vehicleMessage ? <Notice tone={vehicleLookupStatus === 'error' ? 'bad' : 'info'}>{vehicleMessage}</Notice> : null}
      {(vehicleLookupStatus === 'not_found' || vehicleLookupStatus === 'error') ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop">
            <h3 className="cardTitle">Add vehicle manually</h3>
            <div className="fieldHint">Use this for imports/overseas/lookup failures.</div>
          </div>
          <div className="fieldGrid" style={{ marginTop: 10 }}>
            <Field label="Make"><input className="input" value={manualVehicle.make} onChange={(e) => setManualVehicle((v) => ({ ...v, make: e.target.value.toUpperCase() }))} placeholder="BMW" /></Field>
            <Field label="Model"><input className="input" value={manualVehicle.model} onChange={(e) => setManualVehicle((v) => ({ ...v, model: e.target.value.toUpperCase() }))} placeholder="320D" /></Field>
            <Field label="Year"><input className="input" value={manualVehicle.year} onChange={(e) => setManualVehicle((v) => ({ ...v, year: e.target.value }))} placeholder="2016" /></Field>
            <Field label="Fuel type"><input className="input" value={manualVehicle.fuel_type} onChange={(e) => setManualVehicle((v) => ({ ...v, fuel_type: e.target.value.toUpperCase() }))} placeholder="DIESEL" /></Field>
            <Field label="Engine size"><input className="input" value={manualVehicle.engine_size} onChange={(e) => setManualVehicle((v) => ({ ...v, engine_size: e.target.value.toUpperCase() }))} placeholder="2.0L" /></Field>
            <Field label="Colour"><input className="input" value={manualVehicle.colour} onChange={(e) => setManualVehicle((v) => ({ ...v, colour: e.target.value.toUpperCase() }))} placeholder="BLACK" /></Field>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StepCustomer({ firstName, surname, phoneNumber, email, postcode, address, sendDetailsBySms, setSendDetailsBySms, onChangeFirstName, onChangeSurname, onChangePhone, setEmail, setPostcode, setAddress, onCheckCustomer, customerCheckStatus, customerMessage, vehicleCustomers, onSelectExistingCustomer, selectedCustomer, customerMatches, association }) {
  return (
    <div className="intakeStepContent">
      <div className="intakeStepHeader">
        <div className="intakeStepIcon">👤</div>
        <div>
          <h2 className="intakeStepTitle">Customer Details</h2>
          <p className="intakeStepSubtitle">Provide customer contact information</p>
        </div>
      </div>

      <div className="fieldGrid">
        <div className="field">
          <label className="fieldLabel" htmlFor="firstName">
            First name <span className="req">*</span>
          </label>
          <input
            id="firstName"
            className="input"
            value={firstName}
            onChange={(e) => onChangeFirstName(e.target.value)}
            placeholder="e.g. John"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="fieldLabel" htmlFor="surname">
            Surname <span className="req">*</span>
          </label>
          <input
            id="surname"
            className="input"
            value={surname}
            onChange={(e) => onChangeSurname(e.target.value)}
            placeholder="e.g. Smith"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="fieldLabel" htmlFor="phoneNumber">
            Phone number <span className="req">*</span>
          </label>
          <input
            id="phoneNumber"
            className={`input ${phoneNumber && !isLikelyPhoneNumber(phoneNumber) ? 'invalid' : ''}`}
            value={phoneNumber}
            onChange={(e) => onChangePhone(sanitisePhoneInput(e.target.value))}
            placeholder="e.g. 07123 456789"
            inputMode="tel"
            autoComplete="off"
          />
          <div className="fieldHint">
            No SMS is sent yet. Email/address collection will be added later via a secure link.
          </div>
        </div>

        <div className="field">
          <label className="fieldLabel" htmlFor="email">Email (optional)</label>
          <input
            id="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="fieldLabel" htmlFor="postcode">Postcode (optional)</label>
          <input
            id="postcode"
            className="input"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="AB12 3CD"
            autoComplete="off"
          />
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="fieldLabel" htmlFor="address">Address (optional)</label>
          <textarea
            id="address"
            className="textarea"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House number, street, town"
          />
        </div>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="inlineCheck">
            <input
              type="checkbox"
              checked={sendDetailsBySms}
              onChange={(e) => setSendDetailsBySms(e.target.checked)}
            />
            <span>Send customer details request by SMS</span>
          </label>
          <div className="fieldHint">
            If unticked, email/postcode/address can be requested later when a quote is accepted.
          </div>
        </div>

        <div className="field">
          <div className="fieldLabel">Customer match</div>
          <button
            type="button"
            className="secondaryButton"
            onClick={onCheckCustomer}
            disabled={customerCheckStatus === 'loading'}
          >
            {customerCheckStatus === 'loading' ? 'Checking…' : 'Check customer'}
          </button>
          <div className="fieldHint">
            Searches by first name, surname, or phone (database-backed).
          </div>
        </div>
      </div>

      {customerMessage ? <Notice tone={customerCheckStatus === 'error' ? 'bad' : 'info'}>{customerMessage}</Notice> : null}

      {vehicleCustomers.length ? (
        <div className="matches" style={{ marginTop: 12 }}>
          <div className="matchesTitle">Linked to this vehicle</div>
          <div className="fieldHint" style={{ marginTop: 6 }}>
            These are customers already linked to the vehicle in the database.
          </div>
          <div className="matchList" style={{ marginTop: 10 }}>
            {vehicleCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                className="matchRow"
                onClick={() => onSelectExistingCustomer(c)}
              >
                <div className="matchName">
                  {c.first_name} {c.surname}{' '}
                  {c.is_current_owner ? (
                    <span className="fieldHint">· current keeper</span>
                  ) : null}
                </div>
                <div className="matchPhone">{c.phone}</div>
                <div className="matchAction">Use</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedCustomer ? (
        <div className="selectedCustomer">
          <div className="selectedTitle">Selected existing customer</div>
          <div className="selectedText">
            {selectedCustomer.first_name} {selectedCustomer.surname} · {selectedCustomer.phone}
          </div>
        </div>
      ) : null}

      {customerMatches.length ? (
        <div className="matches">
          <div className="matchesTitle">Matches</div>
          <div className="matchList">
            {customerMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                className="matchRow"
                onClick={() => onSelectExistingCustomer(c)}
              >
                <div className="matchName">
                  {c.first_name} {c.surname}
                </div>
                <div className="matchPhone">{c.phone}</div>
                <div className="matchAction">Select</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {association ? (
        <div className="association">
          <div className="associationTitle">{association.title}</div>
          <div className="associationText">{association.text}</div>
        </div>
      ) : null}
    </div>
  )
}

function StepService({ servicesStatus, servicesError, serviceTemplateId, setServiceTemplateId, setDurationOverridden, serviceTemplates, selectedService, estimatedDays, setEstimatedDays, estimatedHours, setEstimatedHours, customServiceTitle, setCustomServiceTitle }) {
  return (
    <div className="intakeStepContent">
      <div className="intakeStepHeader">
        <div className="intakeStepIcon">🔧</div>
        <div>
          <h2 className="intakeStepTitle">Job Service</h2>
          <p className="intakeStepSubtitle">Choose the service type and details</p>
        </div>
      </div>

      {servicesStatus === 'error' ? (
        <Notice tone="bad">{servicesError}</Notice>
      ) : (
        <div className="fieldGrid">
          <div className="field">
            <label className="fieldLabel" htmlFor="serviceTemplateId">
              Service <span className="req">*</span>
            </label>
            <select
              id="serviceTemplateId"
              className="select"
              value={serviceTemplateId}
              onChange={(e) => {
                setServiceTemplateId(e.target.value)
                setDurationOverridden(false)
              }}
              disabled={servicesStatus !== 'ready'}
            >
              <option value="">Select a service…</option>
              {serviceTemplates.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedService && selectedService.requires_quote_first ? (
              <div className="fieldHint">
                Duration may need confirming after quote/inspection.
              </div>
            ) : null}
          </div>

          <div className="field">
            <label className="fieldLabel">Estimated duration</label>
            <div className="pageHeaderActions" style={{ justifyContent: 'flex-start' }}>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={estimatedDays}
                onChange={(e) => {
                  setEstimatedDays(Number(e.target.value || 0))
                  setDurationOverridden(true)
                }}
                placeholder="Days"
                style={{ width: 100 }}
              />
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={estimatedHours}
                onChange={(e) => {
                  setEstimatedHours(Number(e.target.value || 0))
                  setDurationOverridden(true)
                }}
                placeholder="Hours"
                style={{ width: 100 }}
              />
            </div>
            <div className="fieldHint">
              Enter estimated days and hours. This drives booking capacity and calendar planning.
            </div>
          </div>

          {selectedService && String(selectedService.name || '').trim().toLowerCase() === 'other' ? (
            <div className="field">
              <label className="fieldLabel" htmlFor="customServiceTitle">Custom job title (for Other service)</label>
              <input
                id="customServiceTitle"
                className="input"
                value={customServiceTitle}
                onChange={(e) => setCustomServiceTitle(e.target.value)}
                placeholder="e.g. INVESTIGATE INTERMITTENT MISFIRE"
              />
            </div>
          ) : null}

          <div className="field">
            <div className="fieldLabel">Quick notes</div>
            <div className="pillRow">
              <span className="pill">MySQL/MariaDB</span>
              <span className="pill">DVLA/DVSA via webhook</span>
              <span className="pill">No SMS yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepBooking({ requestedDate, setRequestedDate, arrivalTime, setArrivalTime, priority, setPriority, initialStatus, setInitialStatus, onCheckAvailability, availabilityStatus, availabilityError, availabilityResult, motSelected, motRenewalMessage, motTime, setMotTime, motSupplierName, setMotSupplierName, motSupplierContact, setMotSupplierContact, motIsExternal, setMotIsExternal, reminderOffsetsEnabled, setReminderOffsetsEnabled, onOpenCalendar }) {
  return (
    <div className="intakeStepContent">
      <div className="intakeStepHeader">
        <div className="intakeStepIcon">📅</div>
        <div>
          <h2 className="intakeStepTitle">Booking Details</h2>
          <p className="intakeStepSubtitle">Schedule the appointment</p>
        </div>
      </div>

      <div className="fieldGrid">
        <Field label="Preferred date">
          <input
            className="input"
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
          />
        </Field>

        <Field label="Arrival time">
          <input
            className="input"
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
          />
        </Field>

        <Field label="Priority">
          <select
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="high_value">High value</option>
            <option value="waiting_customer">Waiting customer</option>
          </select>
        </Field>

        <Field label="Initial status">
          <select
            className="select"
            value={initialStatus}
            onChange={(e) => setInitialStatus(e.target.value)}
          >
            <option value="new">New</option>
            <option value="booked">Booked</option>
            <option value="in_progress">In progress</option>
            <option value="waiting_parts">Waiting parts</option>
            <option value="waiting_approval">Waiting approval</option>
            <option value="draft">Draft</option>
          </select>
          <div className="fieldHint">
            Draft jobs may appear faded/inactive on calendar unless inactive jobs are shown.
          </div>
        </Field>
      </div>

      <div className="availabilityRow">
        <button
          type="button"
          className="secondaryButton"
          onClick={onCheckAvailability}
          disabled={availabilityStatus === 'loading'}
        >
          {availabilityStatus === 'loading' ? 'Checking…' : 'Check availability'}
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={onOpenCalendar}
          style={{ marginLeft: 8 }}
        >
          View Workshop Calendar
        </button>
        <div className="fieldHint">
          Basic database-backed check against seeded jobs. Urgent/high-value fit-in logic will be improved later.
        </div>
      </div>

      {availabilityError ? <Notice tone="bad">{availabilityError}</Notice> : null}
      {availabilityResult ? (
        <Notice tone={availabilityResult.busy ? 'warn' : 'good'}>
          {availabilityResult.message}{' '}
          {availabilityResult.suggestion ? (
            <span>
              Suggested: {availabilityResult.suggestion.requested_date}{' '}
              {availabilityResult.suggestion.arrival_time}
            </span>
          ) : null}
        </Notice>
      ) : null}

      {motSelected ? (
        <div className="motPanel">
          <div className="motHeader">
            <div>
              <div className="motTitle">MOT panel</div>
              <div className="motSubtitle">
                External MOT reminder templates are defaults for now (admin-configurable later).
              </div>
              {motRenewalMessage ? (
                <div className="fieldHint" style={{ marginTop: 8 }}>
                  {motRenewalMessage}
                </div>
              ) : null}
            </div>
            <span className="demoTag">Database</span>
          </div>

          <div className="fieldGrid">
            <Field label="MOT time">
              <input
                className="input"
                type="time"
                value={motTime}
                onChange={(e) => setMotTime(e.target.value)}
              />
            </Field>

            <Field label="MOT supplier/station">
              <input
                className="input"
                value={motSupplierName}
                onChange={(e) => setMotSupplierName(e.target.value)}
                placeholder="e.g. Local MOT Centre"
              />
            </Field>

            <Field label="Supplier contact name">
              <input
                className="input"
                value={motSupplierContact}
                onChange={(e) => setMotSupplierContact(e.target.value)}
                placeholder="e.g. Sam"
              />
            </Field>

            <Field label="Onsite or offsite MOT">
              <div className="toggleRow">
                <button
                  type="button"
                  className={`toggle ${!motIsExternal ? 'active' : ''}`}
                  onClick={() => setMotIsExternal(false)}
                >
                  Onsite
                </button>
                <button
                  type="button"
                  className={`toggle ${motIsExternal ? 'active' : ''}`}
                  onClick={() => setMotIsExternal(true)}
                >
                  Offsite
                </button>
              </div>
            </Field>
          </div>

          {motIsExternal ? (
            <div className="remindersBox">
              <div className="remindersTitle">Default reminders (external MOT)</div>
              <div className="remindersHint">
                TODO: Admin-configurable reminder templates will be added later. For now you can untick reminders for this onboarding.
              </div>
              <div className="remindersGrid">
                {DEFAULT_REMINDER_OFFSETS.map((off) => (
                  <label key={off} className="checkRow">
                    <input
                      type="checkbox"
                      checked={Boolean(reminderOffsetsEnabled[off])}
                      onChange={(e) =>
                        setReminderOffsetsEnabled((s) => ({
                          ...s,
                          [off]: e.target.checked,
                        }))
                      }
                    />
                    <span>{Math.abs(off)} minutes before</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StepNotes({ notesCustomerWords, setNotesCustomerWords, notesInternal, setNotesInternal, regNormalised, firstName, surname, phoneNumber, selectedCustomer, selectedService, requestedDate, arrivalTime, requiredMissing, canSave, saveStatus, onSaveIntake, saveError, saveResult, customerDetailsLink, onCreateQuoteNow, resetForAnother, onViewJob }) {
  return (
    <div className="intakeStepContent">
      <div className="intakeStepHeader">
        <div className="intakeStepIcon">📝</div>
        <div>
          <h2 className="intakeStepTitle">Notes & Summary</h2>
          <p className="intakeStepSubtitle">Review and add final notes</p>
        </div>
      </div>

      <div className="fieldGrid">
        <Field label="What the customer said">
          <textarea
            className="textarea"
            value={notesCustomerWords}
            onChange={(e) => setNotesCustomerWords(e.target.value)}
            rows={5}
            placeholder="Capture the customer's words and symptoms..."
          />
        </Field>

        <Field label="Office notes">
          <textarea
            className="textarea"
            value={notesInternal}
            onChange={(e) => setNotesInternal(e.target.value)}
            rows={5}
            placeholder="Internal notes for the team..."
          />
        </Field>
      </div>

      <div className="saveRow">
        <div className="cardBox" style={{ width: '100%', marginBottom: 10 }}>
          <div className="cardTop">
            <h3 className="cardTitle">Call summary</h3>
            <div className="fieldHint">
              {requiredMissing.length ? `${requiredMissing.length} required missing` : 'Ready to save'}
            </div>
          </div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="fieldLabel">REG</div>
              <div className="mono">{regNormalised || '—'}</div>
            </div>
            <div className="field">
              <div className="fieldLabel">Customer</div>
              <div className="fieldHint" style={{ marginTop: 8 }}>
                {String(firstName).trim() || String(surname).trim()
                  ? `${firstName} ${surname}`.trim()
                  : '—'}
                {phoneNumber ? ` · ${phoneNumber}` : ''}
                {selectedCustomer ? ' · existing' : ' · new'}
              </div>
            </div>
            <div className="field">
              <div className="fieldLabel">Service</div>
              <div className="fieldHint" style={{ marginTop: 8 }}>
                {selectedService ? selectedService.name : '—'}
              </div>
            </div>
            <div className="field">
              <div className="fieldLabel">Booking</div>
              <div className="fieldHint" style={{ marginTop: 8 }}>
                {requestedDate || '—'} {arrivalTime || ''}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="primaryButton"
          disabled={!canSave}
          onClick={onSaveIntake}
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save onboarding'}
        </button>

        <div className="requiredBox" role="status" aria-live="polite">
          <div className="requiredTitle">Required before saving</div>
          {requiredMissing.length ? (
            <div className="requiredList">
              Missing: {requiredMissing.join(', ')}
            </div>
          ) : (
            <div className="requiredList ok">Ready to save.</div>
          )}
        </div>

        {saveError ? <Notice tone="bad">{saveError}</Notice> : null}
        {saveResult ? (
          <Notice tone="good">
            Saved. Job created: #{saveResult.id} —{' '}
            <span className="mono">{saveResult.registration || 'REG'}</span> —{' '}
            {saveResult.title} ({saveResult.status})
          </Notice>
        ) : null}
        {customerDetailsLink ? (
          <div className="customerDetailsRequestCard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 className="cardTitle" style={{ margin: '0 0 4px 0' }}>Customer Details Request</h3>
                <div className="fieldHint">Share this link with the customer to collect missing contact details</div>
              </div>
            </div>
            <div style={{ background: 'rgba(148, 163, 184, 0.06)', padding: 10, borderRadius: 8, marginBottom: 12, fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: 'var(--muted)', border: '1px solid var(--separator)' }}>
              {customerDetailsLink}
            </div>
            <div className="pageHeaderActions" style={{ gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  navigator.clipboard.writeText(customerDetailsLink)
                  alert('Link copied to clipboard')
                }}
                title="Copy link to clipboard"
              >
                📋 Copy link
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => window.open(customerDetailsLink, '_blank')}
                title="Open link in new tab"
              >
                🔗 Open link
              </button>
            </div>
            <div className="fieldHint" style={{ fontSize: 12 }}>
              ⓘ SMS sending is not connected yet. Copy this link and send it to the customer manually via SMS, email, or WhatsApp.
            </div>
          </div>
        ) : null}

        {saveResult ? (
          <div className="notice info" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 950 }}>Next actions</div>
            <div className="pageHeaderActions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="primaryButton"
                onClick={onCreateQuoteNow}
              >
                Create quote now
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => onViewJob && onViewJob(saveResult.id)}
              >
                View job
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={resetForAnother}
              >
                Start another onboarding
              </button>
            </div>
          </div>
        ) : null}

        <div className="fieldHint">
          This saves via the backend API to the configured MySQL/MariaDB
          database. If you see an error, database setup may be required
          (open Set-up).
        </div>
      </div>

      {showingCalendarModal && (
        <div className="modalOverlay" onClick={() => setShowingCalendarModal(false)}>
          <div className="modal" style={{ width: '90vw', maxWidth: '90vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <h2 style={{ margin: 0 }}>Workshop Calendar</h2>
              <button
                type="button"
                className="closeButton"
                onClick={() => setShowingCalendarModal(false)}
                title="Close calendar"
                style={{ marginTop: -6 }}
              >
                ✕
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <Calendar embedded={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="summaryItem">
      <div className="summaryLabel">{label}</div>
      <div className="summaryValue">{value || '—'}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="fieldLabel">{label}</div>
      {children}
    </div>
  )
}

function Notice({ tone, children }) {
  return <div className={`notice ${tone || 'info'}`}>{children}</div>
}
