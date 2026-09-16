CREATE POLICY "Team can read org documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'org-documents');
CREATE POLICY "Team can upload org documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'org-documents');
CREATE POLICY "Team can update org documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'org-documents') WITH CHECK (bucket_id = 'org-documents');
CREATE POLICY "Team can delete org documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'org-documents');