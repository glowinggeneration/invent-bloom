INSERT INTO public.x_accounts (user_id, handle, display_name, persona_label, auth_token, is_active)
VALUES
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','PamBarnes898482','Pam Barnes','','ee245e941e13824e81926a1e62b7023b27dfddf7',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','SandsFried76229','Sands Fried','','ee2567167fc4437d3c3eed42e491688828621919',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','HWatson75972','H Watson','','ee27c7bdbd07915839837b559f72b09d7084ff7b',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','deborah3277807','Deborah','','ee2ae989b964f34cc8291e575580dca0c023e1a8',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','BiniarisAngelis','Angelis Biniaris','','ee2d37de3ac2f665b2245f3e1920302a0983f7ee',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','Shadyy31695023','Shadyy','','ee2da91c89d29c22576e9585061fcffd94486b92',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','JohnNathan93794','John Nathan','','ee37d3259b02706e7b3da0c256cf43c70a9a6f73',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','kennycmra','Kenny','','ee392154dd800afbbc8e74a8953c7bbbe6c70a6e',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','jbopp17','J Bopp','','ee39f74080a9cbdd11a0ab2a1c7285a65c9433fb',true),
 ('7ea6978a-ab46-48ea-98b7-29ad6f137944','RainHug275041','Rain Hug','','ee3a05e452586f89d835e2cac9195e3540392080',true)
ON CONFLICT (user_id, handle) DO UPDATE SET auth_token = EXCLUDED.auth_token, is_active = true;