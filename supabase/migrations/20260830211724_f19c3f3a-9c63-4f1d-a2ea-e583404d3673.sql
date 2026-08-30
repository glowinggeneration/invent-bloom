DROP POLICY IF EXISTS "Admin manages managed report files" ON storage.objects;
CREATE POLICY "Admin manages managed report files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'managed-reports' AND (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com')
WITH CHECK (bucket_id = 'managed-reports' AND (auth.jwt() ->> 'email') = 'ledimothabo@gmail.com');

DROP POLICY IF EXISTS "Signed-in users read managed report files" ON storage.objects;
CREATE POLICY "Signed-in users read managed report files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'managed-reports');