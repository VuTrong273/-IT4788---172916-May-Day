-- Add intake forms without modifying existing records or accounts.
-- Template structure is only seeded if that template has no sections yet.
BEGIN;
DO $$
DECLARE
  form RECORD;
  section RECORD;
  question JSONB;
  option JSONB;
  sid INTEGER;
  qid TEXT;
  position INTEGER;
BEGIN
  FOR form IN SELECT * FROM (VALUES
    ('TPL_ACUTE_V1','Phiếu khám mề đay - khởi phát dưới 6 tuần','UA'),
    ('TPL_CHRONIC_V1','Phiếu khám mề đay - khởi phát từ 6 tuần','UC')
  ) AS forms(code,name,prefix)
  LOOP
    INSERT INTO templates(code_template,name,description,version,is_active)
    VALUES(form.code,form.name,'Phiếu khai thác thông tin và khám mề đay. Phân nhóm thời gian chỉ định hướng phiếu; bác sĩ xác nhận chẩn đoán.','1.0',1)
    ON CONFLICT(code_template) DO NOTHING;
    IF EXISTS(SELECT 1 FROM template_sections WHERE template_id=form.code) THEN CONTINUE; END IF;
    FOR section IN SELECT * FROM (VALUES
      (1,'Lý do khám và diễn tiến','patient',1,'[
        {"id":"REASON","text":"Lý do đến khám","type":"textarea","required":1},
        {"id":"ONSET","text":"Ngày bắt đầu xuất hiện triệu chứng","type":"date","required":1},
        {"id":"FREQUENCY","text":"Tần suất xuất hiện","type":"radio","required":1,"options":[["daily","Hằng ngày"],["recurrent","Tái diễn từng đợt"],["first","Lần đầu"]]},
        {"id":"DURATION","text":"Một nốt/sảng phù thường tồn tại trong bao lâu?","type":"text","required":1}
      ]'),
      (2,'Triệu chứng và ảnh tổn thương','patient',1,'[
        {"id":"SYMPTOMS","text":"Triệu chứng ghi nhận","type":"checkbox","required":1,"options":[["wheals","Sảng phù/nổi mề đay"],["itch","Ngứa"],["swelling","Sưng/phù"],["other","Khác"]]},
        {"id":"LOCATION","text":"Vị trí xuất hiện tổn thương","type":"text","required":1},
        {"id":"SWELLING","text":"Mô tả vị trí và diễn tiến sưng/phù","type":"textarea","required":1,"parent":"SYMPTOMS","when":["swelling"]},
        {"id":"PHOTO","text":"Ảnh tổn thương hiện tại hoặc các đợt trước","type":"image","required":0}
      ]'),
      (3,'Tiền sử và điều trị trước đây','patient',1,'[
        {"id":"HISTORY","text":"Bệnh kèm, tiền sử dị ứng và thuốc đang sử dụng","type":"textarea","required":1},
        {"id":"TRIGGERS","text":"Yếu tố nghi làm triệu chứng xuất hiện hoặc nặng hơn","type":"textarea","required":0},
        {"id":"PREVIOUS_RX","text":"Thuốc/điều trị đã thử và đáp ứng; ghi Không nếu chưa điều trị","type":"textarea","required":1},
        {"id":"IMPACT","text":"Ảnh hưởng đến giấc ngủ và sinh hoạt","type":"textarea","required":0}
      ]'),
      (4,'Khám và nhận định của bác sĩ','doctor',1,'[
        {"id":"EXAM","text":"Kết quả khám và nhận xét ảnh tổn thương","type":"textarea","required":1},
        {"id":"DIAGNOSIS","text":"Chẩn đoán/nhận định của bác sĩ","type":"textarea","required":1},
        {"id":"INVESTIGATION","text":"Nhận định về xét nghiệm hoặc đánh giá bổ sung","type":"textarea","required":0}
      ]'),
      (5,'Kế hoạch điều trị và tái khám','doctor',1,'[
        {"id":"PLAN","text":"Kế hoạch điều trị, lời dặn và theo dõi tại nhà","type":"textarea","required":1},
        {"id":"FOLLOWUP","text":"Ngày hẹn tái khám dự kiến","type":"date","required":0}
      ]')
    ) AS sections(position,title,actor,required,questions)
    LOOP
      INSERT INTO template_sections(template_id,title,sort_order,filled_by,is_required)
      VALUES(form.code,section.title,section.position,section.actor,section.required) RETURNING section_id INTO sid;
      position := 0;
      FOR question IN SELECT value FROM jsonb_array_elements(section.questions::jsonb)
      LOOP
        position := position + 1;
        qid := form.prefix || '_' || (question->>'id');
        INSERT INTO questions(question_id,section_id,question_text,type_question,sort_order,is_required,allow_image,parent_question_id,show_if_answer)
        VALUES(qid,sid,question->>'text',question->>'type',position,(question->>'required')::smallint,
          CASE WHEN question->>'type'='image' THEN 1 ELSE 0 END,
          CASE WHEN question ? 'parent' THEN form.prefix || '_' || (question->>'parent') ELSE NULL END,
          CASE WHEN question ? 'parent' THEN jsonb_build_object(form.prefix || '_' || (question->>'parent'),question->'when') ELSE NULL END);
        FOR option IN SELECT value FROM jsonb_array_elements(COALESCE(question->'options','[]'::jsonb))
        LOOP
          INSERT INTO question_options(question_id,option_value,option_text,sort_order)
          VALUES(qid,option->>0,option->>1,(SELECT count(*) FROM question_options WHERE question_id=qid));
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
