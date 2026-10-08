-- =====================================================================
--  MAY DAY (DrMayDay) - Hệ thống quản lý bệnh mề đay
--  DBMS     : PostgreSQL 14+
--  QUY ƯỚC
--   * PK: số nguyên tự tăng (GENERATED ... AS IDENTITY), TRỪ 2 bảng:
--       - templates.code_template  VARCHAR(225)  (API gọi là template_id / id)
--       - questions.question_id    VARCHAR(50)   (client tự đặt, vd "Q_ITCH")
--   * Tên cột "order" là từ khoá SQL -> DB dùng `sort_order`, API vẫn dùng `order`.
--   * Tên PK dạng <thực thể>_id. API của một số module trả về `id`
--     (branches, departments, rooms, roles, permissions, ...): backend tự map.
--   * Cột boolean của spec (is_active, is_required, allow_image...) dùng SMALLINT 0/1
--     để khớp với API ("1"/"0").
--   * Thời gian: TIMESTAMPTZ. Trigger set_updated_at() tự cập nhật updated_at.
--   * Quy tắc xoá (spec slide 3.6): CASCADE / SET NULL / RESTRICT ghi rõ ở từng FK.
--   * Khi RESTRICT chặn xoá -> backend bắt lỗi SQLSTATE 23503 và trả code 2003.
--
--  KHÁC SO VỚI SPEC GỐC (đã thống nhất, xem PRD mục Decision):
--   - Không có 3 bảng thông báo (notifications, user_fcm_tokens,
--     user_notification_settings) -> 32 - 3 = 29 bảng.
--   - users.role_id nằm ở bảng users (mọi tài khoản, kể cả bệnh nhân, đều có vai trò);
--     staffs chỉ giữ branch/department/room.
--   - OTP quên mật khẩu lưu trong users (reset_token, reset_token_expires, reset_attempts).
--   - Thêm api_endpoints.is_public để middleware bỏ qua kiểm tra quyền với API công khai.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Hàm dùng chung
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- NHÓM 1. NGƯỜI DÙNG & PHÂN QUYỀN & TỔ CHỨC (12 bảng)
-- =====================================================================

-- 1.1 roles -----------------------------------------------------------
CREATE TABLE roles (
    role_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL UNIQUE,
    description     VARCHAR(255),
    parent_role_id  INTEGER REFERENCES roles(role_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_roles_not_self_parent CHECK (parent_role_id IS DISTINCT FROM role_id)
);
CREATE INDEX idx_roles_parent ON roles(parent_role_id);

-- 1.2 permissions -----------------------------------------------------
CREATE TABLE permissions (
    permission_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 role_permissions (N-N roles <-> permissions) --------------------
CREATE TABLE role_permissions (
    role_permission_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id            INTEGER NOT NULL REFERENCES roles(role_id)             ON DELETE CASCADE,
    permission_id      INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- 1.4 api_endpoints (danh sách API để kiểm tra quyền động) ------------
CREATE TABLE api_endpoints (
    endpoint_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    method       VARCHAR(10)  NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
    path         VARCHAR(255) NOT NULL,          -- dạng pattern, vd /api/v1/medical_records/:id
    description  VARCHAR(255),
    is_public    SMALLINT NOT NULL DEFAULT 0 CHECK (is_public IN (0,1)),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_api_endpoint UNIQUE (method, path)
);

-- 1.5 permissions_endpoints (N-N permissions <-> api_endpoints) -------
CREATE TABLE permissions_endpoints (
    permission_endpoint_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_id          INTEGER NOT NULL REFERENCES permissions(permission_id)  ON DELETE CASCADE,
    endpoint_id            INTEGER NOT NULL REFERENCES api_endpoints(endpoint_id)  ON DELETE CASCADE,
    assigned_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_permission_endpoint UNIQUE (permission_id, endpoint_id)
);
CREATE INDEX idx_permissions_endpoints_endpoint ON permissions_endpoints(endpoint_id);

-- 1.6 branches ---------------------------------------------------------
CREATE TABLE branches (
    branch_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    address     VARCHAR(255) NOT NULL,
    phone       VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.7 departments ------------------------------------------------------
CREATE TABLE departments (
    department_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    description   VARCHAR(255),
    branch_id     INTEGER NOT NULL REFERENCES branches(branch_id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_department_branch UNIQUE (department_id, branch_id)   -- phục vụ FK ghép của staffs
);
CREATE INDEX idx_departments_branch ON departments(branch_id);

-- 1.8 rooms ------------------------------------------------------------
CREATE TABLE rooms (
    room_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    description   VARCHAR(255),
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_room_department UNIQUE (room_id, department_id)      -- phục vụ FK ghép của staffs
);
CREATE INDEX idx_rooms_department ON rooms(department_id);

-- 1.9 users (tài khoản đăng nhập của MỌI vai trò) --------------------------
CREATE TABLE users (
    user_id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name           VARCHAR(150) NOT NULL,
    phone               VARCHAR(10)  NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,                       -- bcrypt
    gender              VARCHAR(10)  CHECK (gender IN ('male','female','other')),
    role_id             INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    is_active           SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    -- OTP quên mật khẩu: lưu HASH của OTP 6 số
    reset_token         VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,                                 -- now() + 10 phút
    reset_attempts      SMALLINT NOT NULL DEFAULT 0,                 -- đếm số lần nhập sai OTP
    -- Token JWT cấp trước mốc này bị coi là vô hiệu (đổi/đặt lại mật khẩu)
    password_changed_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT chk_users_phone_format CHECK (phone ~ '^(03|05|07|08|09)[0-9]{8}$')
);
CREATE INDEX idx_users_role      ON users(role_id);
CREATE INDEX idx_users_full_name ON users(lower(full_name));           -- tìm kiếm theo tên
CREATE INDEX idx_users_active    ON users(is_active);

-- 1.10 staffs (hồ sơ nhân viên: bác sĩ, điều dưỡng, admin...) ---------------
CREATE TABLE staffs (
    user_id        INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    branch_id      INTEGER NOT NULL REFERENCES branches(branch_id) ON DELETE RESTRICT,
    department_id  INTEGER NOT NULL,
    room_id        INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Khoa phải thuộc đúng chi nhánh; phòng phải thuộc đúng khoa (vi phạm -> lỗi 2003)
    CONSTRAINT fk_staffs_department FOREIGN KEY (department_id, branch_id)
        REFERENCES departments(department_id, branch_id) ON DELETE RESTRICT,
    CONSTRAINT fk_staffs_room FOREIGN KEY (room_id, department_id)
        REFERENCES rooms(room_id, department_id) ON DELETE RESTRICT
);
CREATE INDEX idx_staffs_branch     ON staffs(branch_id);
CREATE INDEX idx_staffs_department ON staffs(department_id);
CREATE INDEX idx_staffs_room       ON staffs(room_id);

-- 1.11 patients (hồ sơ hành chính bệnh nhân) --------------------------------
CREATE TABLE patients (
    user_id                  INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    year_of_birth            SMALLINT CHECK (year_of_birth BETWEEN 1900 AND 2100),
    career                   VARCHAR(150),
    ethnic                   VARCHAR(50),
    hamlet_address           VARCHAR(150),
    commune_address          VARCHAR(150),
    city_address             VARCHAR(150),
    work_place               VARCHAR(255),
    health_insurance_number  VARCHAR(30),
    health_insurance_validate DATE,
    next_of_kin_name         VARCHAR(150),
    next_of_kin_phone        VARCHAR(20),
    first_visit              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.12 token_blacklist (logout / đổi mật khẩu) ------------------------------
CREATE TABLE token_blacklist (
    token_blacklist_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    jti                VARCHAR(100) NOT NULL UNIQUE,                 -- claim jti của JWT
    user_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at         TIMESTAMPTZ NOT NULL,                         -- = exp của token (để dọn dẹp)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_blacklist_user    ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);  -- job xoá token hết hạn

-- =====================================================================
-- NHÓM 2. FORM ĐỘNG (4 bảng)
-- =====================================================================

-- 2.1 templates --------------------------------------------------------
CREATE TABLE templates (
    code_template VARCHAR(225) PRIMARY KEY,                          -- API: template_id / code_template
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    version       VARCHAR(20)  NOT NULL DEFAULT '1.0',
    is_active     SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_by    INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_active ON templates(is_active);

-- 2.2 template_sections --------------------------------------------------
CREATE TABLE template_sections (
    section_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id  VARCHAR(225) NOT NULL REFERENCES templates(code_template) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,                         -- API: order
    is_required  SMALLINT NOT NULL DEFAULT 0 CHECK (is_required IN (0,1)),
    filled_by    VARCHAR(10) NOT NULL DEFAULT 'patient' CHECK (filled_by IN ('patient','doctor','patdoc')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_template ON template_sections(template_id, sort_order);

-- 2.3 questions --------------------------------------------------------
CREATE TABLE questions (
    question_id         VARCHAR(50) PRIMARY KEY,                     -- client đặt, vd Q_ITCH (duy nhất toàn hệ thống)
    section_id          INTEGER NOT NULL REFERENCES template_sections(section_id) ON DELETE CASCADE,
    question_text       TEXT NOT NULL,
    type_question       VARCHAR(20) NOT NULL
                        CHECK (type_question IN ('text','textarea','number','date','radio','checkbox','select','image')),
    placeholder         VARCHAR(255),
    help_text           TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,                  -- API: order
    is_required         SMALLINT NOT NULL DEFAULT 0 CHECK (is_required IN (0,1)),
    allow_image         SMALLINT NOT NULL DEFAULT 0 CHECK (allow_image IN (0,1)),
    parent_question_id  VARCHAR(50) REFERENCES questions(question_id) ON DELETE CASCADE,  -- xoá cha -> xoá câu con
    show_if_answer      JSONB,                                       -- vd {"Q_PARENT":["yes"]}
    condition_rules     JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_section ON questions(section_id, sort_order);
CREATE INDEX idx_questions_parent  ON questions(parent_question_id);

-- 2.4 question_options ---------------------------------------------------
CREATE TABLE question_options (
    option_id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,  -- API: id
    question_id           VARCHAR(50) NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_text           VARCHAR(255) NOT NULL,
    option_value          VARCHAR(100) NOT NULL,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    trigger_image_upload  SMALLINT NOT NULL DEFAULT 0 CHECK (trigger_image_upload IN (0,1)),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_option_value UNIQUE (question_id, option_value)
);
CREATE INDEX idx_options_question ON question_options(question_id, sort_order);

-- =====================================================================
-- NHÓM 3. BỆNH ÁN, CÂU TRẢ LỜI & ẢNH (4 bảng)
-- =====================================================================

-- 3.1 medical_records --------------------------------------------------
CREATE TABLE medical_records (
    medical_record_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,   -- không xoá BN đã có bệnh án (khoá tài khoản bằng is_active=0)
    assigned_doctor_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_by         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    template_id        VARCHAR(225) NOT NULL REFERENCES templates(code_template) ON DELETE RESTRICT,
    status             VARCHAR(15) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','in_progress','completed')),
    instructions       TEXT,
    completed_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_mr_completed_at CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_mr_patient_status ON medical_records(patient_id, status);
CREATE INDEX idx_mr_patient_created ON medical_records(patient_id, created_at DESC);  -- lịch sử khám
CREATE INDEX idx_mr_doctor_status  ON medical_records(assigned_doctor_id, status);
CREATE INDEX idx_mr_status_created ON medical_records(status, created_at DESC);      -- danh sách chờ nhận
CREATE INDEX idx_mr_template       ON medical_records(template_id);

-- 3.2 media_attachments (metadata ảnh; file thật nằm ở MinIO/S3) ---------------
CREATE TABLE media_attachments (
    attachment_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            INTEGER REFERENCES users(user_id) ON DELETE SET NULL,           -- người upload
    medical_record_id  INTEGER REFERENCES medical_records(medical_record_id) ON DELETE SET NULL,
    question_id        VARCHAR(50) REFERENCES questions(question_id) ON DELETE SET NULL,
    file_path          VARCHAR(500) NOT NULL,                        -- object key trong bucket
    file_url           TEXT,                                         -- URL truy cập (hoặc presigned, sinh khi trả về)
    file_name          VARCHAR(255) NOT NULL,
    file_type          VARCHAR(100) NOT NULL,                        -- MIME: image/jpeg|png|webp
    file_size          INTEGER CHECK (file_size >= 0),               -- byte (<= 5 MB)
    media_type         VARCHAR(10) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','audio','file')),
    category           VARCHAR(50),
    description        VARCHAR(500),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_user    ON media_attachments(user_id, created_at DESC);
CREATE INDEX idx_media_record  ON media_attachments(medical_record_id);
CREATE INDEX idx_media_question ON media_attachments(question_id);

-- 3.3 answers ----------------------------------------------------------
CREATE TABLE answers (
    answer_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_record_id  INTEGER NOT NULL REFERENCES medical_records(medical_record_id) ON DELETE CASCADE,
    question_id        VARCHAR(50)  NOT NULL REFERENCES questions(question_id) ON DELETE RESTRICT,
    question_option_id INTEGER REFERENCES question_options(option_id) ON DELETE SET NULL,
    answer_text        TEXT,
    answer_value       JSONB,                                        -- checkbox: ["a","b"] ...
    answered_by        INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_answer_record_question UNIQUE (medical_record_id, question_id)
);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_option   ON answers(question_option_id);

-- 3.4 answer_images (N-N answers <-> media_attachments) -----------------------
CREATE TABLE answer_images (
    answer_image_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    answer_id       INTEGER NOT NULL REFERENCES answers(answer_id) ON DELETE CASCADE,
    attachment_id   INTEGER NOT NULL REFERENCES media_attachments(attachment_id) ON DELETE CASCADE,
    option_value    VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_answer_attachment UNIQUE (answer_id, attachment_id)         -- trùng -> lỗi 6006
);
CREATE INDEX idx_answer_images_attachment ON answer_images(attachment_id);

-- =====================================================================
-- NHÓM 4. THEO DÕI TỔN THƯƠNG & UAS7 (4 bảng)
-- =====================================================================

-- 4.1 lesion_episodes ----------------------------------------------------
CREATE TABLE lesion_episodes (
    episode_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_record_id     INTEGER NOT NULL REFERENCES medical_records(medical_record_id) ON DELETE CASCADE,
    patient_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name                  VARCHAR(255) NOT NULL,
    occurred_at           TIMESTAMPTZ,
    context_tags          JSONB,                                     -- mảng tag bối cảnh (API nhận/trả chuỗi JSON)
    context_other         VARCHAR(500),
    medication_name       VARCHAR(255),
    medication_taken_ago  NUMERIC(8,2) CHECK (medication_taken_ago >= 0),
    medication_unit       VARCHAR(10) CHECK (medication_unit IN ('minute','hour','day')),
    description           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_episodes_record  ON lesion_episodes(medical_record_id);
CREATE INDEX idx_episodes_patient ON lesion_episodes(patient_id, occurred_at DESC);

-- 4.2 lesion_locations -----------------------------------------------------
CREATE TABLE lesion_locations (
    location_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id            INTEGER NOT NULL REFERENCES lesion_episodes(episode_id) ON DELETE CASCADE,
    body_part             VARCHAR(100) NOT NULL,
    occurred_at           TIMESTAMPTZ,
    context_tags          JSONB,
    context_other         VARCHAR(500),
    medication_name       VARCHAR(255),
    medication_taken_ago  NUMERIC(8,2) CHECK (medication_taken_ago >= 0),
    medication_unit       VARCHAR(10) CHECK (medication_unit IN ('minute','hour','day')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_episode ON lesion_locations(episode_id);

-- 4.3 lesion_photos ------------------------------------------------------
CREATE TABLE lesion_photos (
    photo_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    episode_id     INTEGER NOT NULL REFERENCES lesion_episodes(episode_id) ON DELETE CASCADE,
    location_id    INTEGER REFERENCES lesion_locations(location_id) ON DELETE CASCADE,
    attachment_id  INTEGER NOT NULL REFERENCES media_attachments(attachment_id) ON DELETE CASCADE,
    taken_at       TIMESTAMPTZ,
    milestone      VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (milestone IN ('start','peak','normal')),
    itch_score     SMALLINT CHECK (itch_score  BETWEEN 0 AND 10),
    pain_score     SMALLINT CHECK (pain_score  BETWEEN 0 AND 10),
    burn_score     SMALLINT CHECK (burn_score  BETWEEN 0 AND 10),
    hives_count    INTEGER  CHECK (hives_count >= 0),
    local_auas     NUMERIC(6,2),
    annotated_url  TEXT,                                             -- để trống (AI không làm ở giai đoạn này)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_episode    ON lesion_photos(episode_id, taken_at);
CREATE INDEX idx_photos_location   ON lesion_photos(location_id, taken_at);
CREATE INDEX idx_photos_attachment ON lesion_photos(attachment_id);

-- 4.4 uas7_scores (điểm UAS7 theo ngày) ---------------------------------
-- Quy ước (Decision D5): iss7 = điểm NGỨA (0-3); hss7 = điểm số lượng MỀ ĐAY (0-3).
CREATE TABLE uas7_scores (
    uas7_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    medical_record_id  INTEGER NOT NULL REFERENCES medical_records(medical_record_id) ON DELETE CASCADE,
    score_date         DATE NOT NULL,
    iss7               SMALLINT NOT NULL CHECK (iss7 BETWEEN 0 AND 3),
    hss7               SMALLINT NOT NULL CHECK (hss7 BETWEEN 0 AND 3),
    daily_score        SMALLINT GENERATED ALWAYS AS (iss7 + hss7) STORED,   -- 0..6
    note               VARCHAR(500),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_uas7_patient_date UNIQUE (patient_id, score_date)          -- trùng -> lỗi 5002
);
CREATE INDEX idx_uas7_record ON uas7_scores(medical_record_id);
-- (patient_id, score_date DESC) đã được phủ bởi UNIQUE index uq_uas7_patient_date

-- =====================================================================
-- NHÓM 5. XÉT NGHIỆM & ĐƠN THUỐC (5 bảng)
-- =====================================================================

-- 5.1 lab_requests ----------------------------------------------------------
CREATE TABLE lab_requests (
    lab_request_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_record_id  INTEGER NOT NULL REFERENCES medical_records(medical_record_id) ON DELETE CASCADE,
    requested_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    status             VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_requests_record ON lab_requests(medical_record_id);
CREATE INDEX idx_lab_requests_status ON lab_requests(status);

-- 5.2 lab_request_items ---------------------------------------------------
CREATE TABLE lab_request_items (
    lab_request_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_request_id      INTEGER NOT NULL REFERENCES lab_requests(lab_request_id) ON DELETE CASCADE,
    test_name           VARCHAR(255) NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_items_request ON lab_request_items(lab_request_id);

-- 5.3 lab_results (mỗi chỉ định có tối đa 1 kết quả) --------------------------
CREATE TABLE lab_results (
    lab_result_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lab_request_item_id  INTEGER NOT NULL UNIQUE REFERENCES lab_request_items(lab_request_item_id) ON DELETE CASCADE,
    result_value         TEXT NOT NULL,
    concluded_by         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    note                 TEXT,                                       -- API: result_note
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.4 prescriptions (mỗi bệnh án tối đa 1 đơn -> lỗi 8003) ----------------------
CREATE TABLE prescriptions (
    prescription_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_record_id  INTEGER NOT NULL UNIQUE REFERENCES medical_records(medical_record_id) ON DELETE CASCADE,
    created_by         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.5 prescription_items ------------------------------------------------------
CREATE TABLE prescription_items (
    prescription_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prescription_id      INTEGER NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    medicine_name        VARCHAR(255) NOT NULL,
    dosage               VARCHAR(255) NOT NULL,
    frequency            VARCHAR(255) NOT NULL,
    duration             VARCHAR(255) NOT NULL,
    instruction          TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);

-- =====================================================================
-- TRIGGER updated_at cho mọi bảng có cột updated_at
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.table_name FROM information_schema.columns c
        JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
        WHERE c.table_schema = current_schema() AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
    END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- GHI CHÚ VẬN HÀNH
--  * Dọn token_blacklist hết hạn (cron/job hằng ngày):
--        DELETE FROM token_blacklist WHERE expires_at < now();
--  * Kiểm tra 1 JWT còn hiệu lực: jti không có trong token_blacklist
--        VÀ iat >= users.password_changed_at (nếu cột này khác NULL) VÀ users.is_active = 1.
--  * Điều kiện UAS7 eligibility: bệnh nhân có bệnh án đang điều trị
--        (medical_records.status = 'in_progress'); lấy bệnh án mới nhất.
--  * Tổng UAS7 tuần = SUM(daily_score) của 7 ngày liên tiếp (0..42).
--        Mức độ: 0 | 1-6 | 7-15 | 16-27 | 28-42.
-- =====================================================================
