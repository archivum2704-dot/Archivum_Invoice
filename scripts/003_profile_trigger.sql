-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to create organization with owner membership
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  owner_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  -- Add owner as member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, owner_id, 'owner');

  -- Set as current org for user
  UPDATE public.profiles 
  SET current_org_id = new_org_id 
  WHERE id = owner_id;

  RETURN new_org_id;
END;
$$;

-- Function to update document totals
CREATE OR REPLACE FUNCTION public.update_document_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.documents
  SET 
    subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM public.document_items WHERE document_id = NEW.document_id),
    tax_amount = (SELECT COALESCE(SUM(subtotal * tax_rate / 100), 0) FROM public.document_items WHERE document_id = NEW.document_id),
    total = (SELECT COALESCE(SUM(subtotal * (1 + tax_rate / 100)), 0) FROM public.document_items WHERE document_id = NEW.document_id),
    updated_at = NOW()
  WHERE id = NEW.document_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_doc_totals ON public.document_items;

CREATE TRIGGER update_doc_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.document_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_totals();

-- Function to calculate line item subtotal
CREATE OR REPLACE FUNCTION public.calculate_item_subtotal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.subtotal := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calc_item_subtotal ON public.document_items;

CREATE TRIGGER calc_item_subtotal
  BEFORE INSERT OR UPDATE ON public.document_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_item_subtotal();
