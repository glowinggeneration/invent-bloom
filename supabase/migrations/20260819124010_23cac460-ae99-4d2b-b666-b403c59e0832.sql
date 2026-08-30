DROP POLICY IF EXISTS "Shared workspace x accounts" ON public.x_accounts;

CREATE POLICY "Owners can read their X accounts"
ON public.x_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners can create their X accounts"
ON public.x_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update their X accounts"
ON public.x_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can delete their X accounts"
ON public.x_accounts
FOR DELETE
TO authenticated
USING (user_id = auth.uid());