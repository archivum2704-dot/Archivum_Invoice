# DocVault Demo Setup Guide

This guide explains how to set up and test the DocVault application with demo users and sample data.

## Demo Users

Two demo user accounts have been configured for testing different roles:

### 1. Admin User
- **Email:** `admin@test.com`
- **Password:** `Admin123!`
- **Role:** Admin
- **Access:** 
  - Admin Dashboard with global statistics
  - View all companies and documents
  - Company management
  - System-wide reporting

### 2. Company User
- **Email:** `empresa@test.com`
- **Password:** `Empresa123!`
- **Role:** Company User
- **Access:**
  - Company Dashboard
  - Only documents from their assigned company
  - Company-specific data and statistics
  - Cannot access admin features

## Demo Data

The demo setup includes:

### Demo Company
- **Name:** Empresa Demo
- **CIF:** B12345678
- **Sector:** Servicios
- **City:** Madrid
- **Contact:** Juan García

### Sample Documents
The demo company has the following sample documents:

**Invoices (3):**
- FAC-001: €2,500.00 (Paid, 30 days old)
- FAC-002: €3,750.00 (Sent, 20 days old)
- FAC-003: €1,500.00 (Overdue, 10 days old)

**Receipts (2):**
- REC-001: €500.00 (Paid, 25 days old)
- REC-002: €750.00 (Paid, 5 days old)

**Delivery Notes (2):**
- ALB-001: €1,200.00 (Paid, 28 days old)
- ALB-002: €2,000.00 (Sent, 8 days old)

## How to Set Up Demo Data

### Option 1: Using the Setup Page (Recommended)

1. Start the application
2. Navigate to `/setup`
3. Click "Setup Demo Data"
4. The system will create the demo users and data
5. You'll be redirected to the login page

### Option 2: Manual Setup

1. Execute the SQL migration scripts in order:
   ```bash
   # 1. Create schema
   supabase db push scripts/001_create_schema.sql
   
   # 2. Apply RLS policies
   supabase db push scripts/002_rls_policies.sql
   
   # 3. Create profile trigger
   supabase db push scripts/003_profile_trigger.sql
   
   # 4. Seed demo data
   supabase db push scripts/004_seed_demo_data.sql
   ```

2. Create users in Supabase Auth dashboard:
   - Create `admin@test.com` with password `Admin123!`
   - Create `empresa@test.com` with password `Empresa123!`

3. Set user metadata:
   - Admin user: `{ "role": "admin", "first_name": "Admin", "last_name": "User" }`
   - Company user: `{ "role": "company_user", "first_name": "Juan", "last_name": "García" }`

## Testing Workflow

### Testing Admin User
1. Login with `admin@test.com` / `Admin123!`
2. You'll be redirected to `/admin-dashboard`
3. Verify you can see:
   - All companies (1 demo company)
   - All documents (7 sample documents)
   - Global statistics and totals
   - Complete list of companies and their invoiced amounts

### Testing Company User
1. Login with `empresa@test.com` / `Empresa123!`
2. You'll be redirected to `/dashboard`
3. Verify you can see:
   - Only documents from "Empresa Demo"
   - Company-specific statistics
   - Limited to company data only
   - No access to admin features or other companies

## Role-Based Redirect Logic

After login, users are redirected based on their role:

- **Admin** (`role: "admin"`) → `/admin-dashboard`
- **Company User** (`role: "company_user"`) → `/dashboard`

This redirect happens automatically in the login page after authentication.

## Database Structure

### Organizations
- Multi-tenant support
- Each organization can have multiple users and companies

### Organization Members
- Links users to organizations with roles:
  - `owner`: Full administrative access
  - `admin`: Administrative access
  - `member`: Regular user access
  - `viewer`: Read-only access

### Companies
- Linked to organizations
- Stores company information (CIF, sector, contact details)
- Tracks total invoiced amount

### Documents
- Linked to both organizations and companies
- Supports multiple document types: invoice, receipt, report, contract
- Tracks status: draft, sent, paid, overdue, cancelled

### Profiles
- Auto-created when users sign up
- Contains user metadata (name, email, avatar)

## Important Notes

1. **Email Confirmation:** Both demo users are pre-confirmed so they don't need to verify their email.

2. **Data Isolation:** Due to Row Level Security (RLS) policies, company users can only access their organization's data.

3. **Admin Access:** The admin user has access to all organizations and their data for testing and management purposes.

4. **Document Metadata:** Documents include sample line items and can be extended with additional metadata as needed.

## Troubleshooting

### Demo Users Not Created
- Check that Supabase Auth is properly configured
- Verify that the database schema has been fully applied
- Check browser console for error messages

### Cannot Login
- Ensure you're using the correct email addresses and passwords (case-sensitive)
- Verify email addresses in Supabase Auth dashboard
- Check that user metadata includes the correct "role" field

### Role-Based Redirect Not Working
- Verify user metadata contains the "role" field
- Check the login page code for redirect logic
- Clear browser cache and try again

### Data Not Visible
- Ensure RLS policies have been applied
- Check that you're logged in with the correct user
- Verify that documents are linked to the correct organization and company

## Next Steps

After setting up the demo data, you can:

1. Test the admin dashboard features
2. Test the company user dashboard features
3. Verify data isolation between users
4. Test document upload and management
5. Test search and filtering functionality
6. Validate the UI and user experience for both roles

For more information, see the main README.md file.
