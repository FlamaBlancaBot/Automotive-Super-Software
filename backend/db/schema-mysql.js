'use strict'

// MySQL/MariaDB schema statements.
//
// These statements are used by:
// - `npm run db:init` (CLI)
// - `/api/setup/init` (browser-based setup)
//
// IMPORTANT:
// - These statements only CREATE missing tables/indexes.
// - They do not drop tables and do not delete data.

const MYSQL_SCHEMA_STATEMENTS = [
  `
  CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(180) NULL,
    postcode VARCHAR(20) NULL,
    address TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customers_phone (phone),
    KEY idx_customers_name (surname, first_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    registration VARCHAR(20) NOT NULL,
    make VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    year VARCHAR(10) NULL,
    fuel_type VARCHAR(30) NULL,
    engine_size VARCHAR(30) NULL,
    colour VARCHAR(30) NULL,
    mot_status VARCHAR(30) NULL,
    mot_expiry VARCHAR(20) NULL,
    last_mot_date VARCHAR(20) NULL,
    last_recorded_mileage VARCHAR(30) NULL,
    last_lookup_at DATETIME NULL,
    lookup_source VARCHAR(30) NULL,
    lookup_error VARCHAR(255) NULL,
    mot_tests_json JSON NULL,
    mot_failures_json JSON NULL,
    mot_advisories_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vehicles_registration (registration)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS customer_vehicles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    relationship_status VARCHAR(30) NULL,
    is_current_owner TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customer_vehicles_vehicle (vehicle_id),
    KEY idx_customer_vehicles_customer (customer_id),
    CONSTRAINT fk_cv_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_cv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS service_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NULL,
    fuel_type VARCHAR(30) NULL,
    default_duration_minutes INT NULL,
    duration_confidence VARCHAR(20) NULL,
    fixed_price DECIMAL(10,2) NULL,
    description TEXT NULL,
    requires_quote_first TINYINT(1) NOT NULL DEFAULT 0,
    is_mot TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_service_templates_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    service_template_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL,
    priority VARCHAR(30) NOT NULL,
    requested_date VARCHAR(20) NULL,
    booked_start VARCHAR(25) NULL,
    booked_end VARCHAR(25) NULL,
    estimated_duration_minutes INT NULL,
    duration_margin_minutes INT NULL,
    mot_supplier_name VARCHAR(150) NULL,
    mot_supplier_contact VARCHAR(150) NULL,
    mot_time VARCHAR(25) NULL,
    mot_is_external TINYINT(1) NOT NULL DEFAULT 0,
    notes_customer_words TEXT NULL,
    notes_internal TEXT NULL,
    mileage_in VARCHAR(30) NULL,
    mileage_out VARCHAR(30) NULL,
    technician_name VARCHAR(150) NULL,
    job_checklist TEXT NULL,
    technician_notes TEXT NULL,
    extra_work_found TEXT NULL,
    final_checks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_jobs_booked_start (booked_start),
    KEY idx_jobs_status (status),
    KEY idx_jobs_requested_date (requested_date),
    CONSTRAINT fk_jobs_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_jobs_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    CONSTRAINT fk_jobs_service FOREIGN KEY (service_template_id) REFERENCES service_templates(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id BIGINT UNSIGNED NOT NULL,
    reminder_type VARCHAR(50) NOT NULL,
    remind_at VARCHAR(25) NOT NULL,
    offset_minutes INT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    dismissed_at VARCHAR(25) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reminders_job (job_id),
    CONSTRAINT fk_reminders_job FOREIGN KEY (job_id) REFERENCES jobs(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS suppliers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    website VARCHAR(200) NULL,
    notes TEXT NULL,
    usage_quotes TINYINT(1) NOT NULL DEFAULT 1,
    usage_parts TINYINT(1) NOT NULL DEFAULT 1,
    usage_mot TINYINT(1) NOT NULL DEFAULT 1,
    usage_diagnostics TINYINT(1) NOT NULL DEFAULT 1,
    usage_general TINYINT(1) NOT NULL DEFAULT 1,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_suppliers_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS job_statuses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(120) NOT NULL,
    colour VARCHAR(30) NOT NULL DEFAULT 'grey',
    sort_order INT NOT NULL DEFAULT 100,
    appears_on_calendar TINYINT(1) NOT NULL DEFAULT 1,
    calendar_active TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_job_statuses_code (code),
    KEY idx_job_statuses_active (active),
    KEY idx_job_statuses_calendar (appears_on_calendar, calendar_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS quotes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quote_number VARCHAR(20) NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    job_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    title VARCHAR(255) NOT NULL,
    internal_notes TEXT NULL,
    customer_notes TEXT NULL,
    subtotal_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    subtotal_sell DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_sell DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estimated_margin DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_quotes_quote_number (quote_number),
    KEY idx_quotes_customer_id (customer_id),
    KEY idx_quotes_vehicle_id (vehicle_id),
    KEY idx_quotes_job_id (job_id),
    KEY idx_quotes_status (status),
    CONSTRAINT fk_quotes_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_quotes_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    CONSTRAINT fk_quotes_job FOREIGN KEY (job_id) REFERENCES jobs(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS quote_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quote_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit_sell DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    markup_percent DECIMAL(6,2) NULL,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    eta_text VARCHAR(100) NULL,
    total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_sell DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    supplier_id BIGINT UNSIGNED NULL,
    part_brand VARCHAR(100) NULL,
    part_number VARCHAR(100) NULL,
    selected_for_quote TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 100,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_quote_items_quote_id (quote_id),
    CONSTRAINT fk_quote_items_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_quote_items_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS part_supplier_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quote_item_id BIGINT UNSIGNED NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    part_name VARCHAR(150) NULL,
    description TEXT NULL,
    brand VARCHAR(100) NULL,
    part_number VARCHAR(100) NULL,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    markup_percent DECIMAL(6,2) NULL,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    eta_text VARCHAR(100) NULL,
    eta_datetime DATETIME NULL,
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    is_ordered TINYINT(1) NOT NULL DEFAULT 0,
    is_selected TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_part_supplier_options_quote_item_id (quote_item_id),
    KEY idx_part_supplier_options_supplier_id (supplier_id),
    CONSTRAINT fk_pso_quote_item FOREIGN KEY (quote_item_id) REFERENCES quote_items(id),
    CONSTRAINT fk_pso_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS predefined_quote_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_type VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    default_unit VARCHAR(30) NULL,
    default_cost_ex_vat DECIMAL(10,2) NULL,
    default_sell_ex_vat DECIMAL(10,2) NULL,
    default_markup_percent DECIMAL(6,2) NULL,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_predefined_quote_items_name (name),
    KEY idx_predefined_quote_items_active (active),
    KEY idx_predefined_quote_items_type (item_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS invoices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id BIGINT UNSIGNED NOT NULL,
    quote_id BIGINT UNSIGNED NULL,
    customer_id BIGINT UNSIGNED NULL,
    vehicle_id BIGINT UNSIGNED NULL,
    invoice_number VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    subtotal_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_inc_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_invoices_invoice_number (invoice_number),
    KEY idx_invoices_job_id (job_id),
    KEY idx_invoices_quote_id (quote_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_price_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    total_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_inc_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_invoice_items_invoice_id (invoice_id),
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS document_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    template_key VARCHAR(80) NOT NULL,
    template_type VARCHAR(30) NOT NULL,
    name VARCHAR(160) NOT NULL,
    subject VARCHAR(255) NULL,
    body_html MEDIUMTEXT NULL,
    body_text MEDIUMTEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_document_templates_key (template_key),
    KEY idx_document_templates_type (template_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS company_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_name VARCHAR(180) NULL,
    trading_name VARCHAR(180) NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(180) NULL,
    address TEXT NULL,
    vat_number VARCHAR(60) NULL,
    default_vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    quote_prefix VARCHAR(20) NULL,
    invoice_prefix VARCHAR(20) NULL,
    theme_default VARCHAR(12) NOT NULL DEFAULT 'dark',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS technicians (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    capabilities TEXT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_technicians_active (active),
    KEY idx_technicians_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS parts_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id BIGINT UNSIGNED NULL,
    quote_id BIGINT UNSIGNED NULL,
    quote_item_id BIGINT UNSIGNED NULL,
    selected_supplier_option_id BIGINT UNSIGNED NULL,
    vehicle_id BIGINT UNSIGNED NULL,
    customer_id BIGINT UNSIGNED NULL,
    supplier_id BIGINT UNSIGNED NULL,
    part_name VARCHAR(255) NULL,
    description TEXT NULL,
    brand VARCHAR(100) NULL,
    part_number VARCHAR(100) NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    cost_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sell_ex_vat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vat_rate DECIMAL(6,4) NOT NULL DEFAULT 0.2000,
    eta_text VARCHAR(100) NULL,
    eta_datetime DATETIME NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    ordered_at DATETIME NULL,
    expected_at DATETIME NULL,
    received_at DATETIME NULL,
    fitted_at DATETIME NULL,
    supplier_invoice_number VARCHAR(80) NULL,
    delivery_note_number VARCHAR(80) NULL,
    received_by VARCHAR(100) NULL,
    return_status VARCHAR(30) NULL,
    return_reason TEXT NULL,
    credit_note_number VARCHAR(80) NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_parts_orders_job_id (job_id),
    KEY idx_parts_orders_quote_id (quote_id),
    KEY idx_parts_orders_vehicle_id (vehicle_id),
    KEY idx_parts_orders_supplier_id (supplier_id),
    KEY idx_parts_orders_status (status),
    KEY idx_parts_orders_expected_at (expected_at),
    KEY idx_parts_orders_quote_item_id (quote_item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS goods_received (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parts_order_id BIGINT UNSIGNED NOT NULL,
    quantity_received DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by VARCHAR(100) NULL,
    supplier_invoice_number VARCHAR(80) NULL,
    delivery_note_number VARCHAR(80) NULL,
    correct_part TINYINT(1) NOT NULL DEFAULT 1,
    condition_ok TINYINT(1) NOT NULL DEFAULT 1,
    return_required TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_goods_received_parts_order_id (parts_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS part_status_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parts_order_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    notes TEXT NULL,
    changed_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_part_status_logs_parts_order_id (parts_order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    session_token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_user_sessions_token (session_token_hash),
    KEY idx_user_sessions_user (user_id),
    KEY idx_user_sessions_expires (expires_at),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NULL,
    action VARCHAR(80) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    metadata_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_activity_entity (entity_type, entity_id),
    KEY idx_activity_user (user_id),
    KEY idx_activity_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS customer_detail_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NULL,
    job_id BIGINT UNSIGNED NULL,
    quote_id BIGINT UNSIGNED NULL,
    token_hash VARCHAR(64) NOT NULL,
    token_preview VARCHAR(50) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    requested_fields_json JSON NULL,
    expires_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_customer_detail_token_hash (token_hash),
    KEY idx_customer_detail_status (status),
    KEY idx_customer_detail_customer (customer_id),
    KEY idx_customer_detail_quote (quote_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  `
  CREATE TABLE IF NOT EXISTS mot_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    supplier_id BIGINT UNSIGNED NULL,
    mot_type VARCHAR(30) NULL,
    mot_time DATETIME NULL,
    expected_duration_minutes INT NOT NULL DEFAULT 45,
    status VARCHAR(30) NOT NULL DEFAULT 'booked',
    result VARCHAR(30) NULL,
    checked_at DATETIME NULL,
    result_checked_at DATETIME NULL,
    next_check_at DATETIME NULL,
    failures_json JSON NULL,
    advisories_json JSON NULL,
    minors_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_mot_events_job (job_id),
    KEY idx_mot_events_vehicle (vehicle_id),
    KEY idx_mot_events_status (status),
    KEY idx_mot_events_time (mot_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
]

module.exports = {
  MYSQL_SCHEMA_STATEMENTS,
}
