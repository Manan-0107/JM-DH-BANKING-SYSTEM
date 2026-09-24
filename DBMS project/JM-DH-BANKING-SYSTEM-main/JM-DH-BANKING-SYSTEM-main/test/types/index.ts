export interface Customer {
  customer_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  address?: string | null;
  created_at?: string;
  status: 'Active' | 'Blocked' | 'Pending';
  kyc_status: 'Verified' | 'Pending' | 'Rejected';
  credit_score?: number;
  tier?: 'Silver' | 'Gold' | 'Platinum' | 'VIP';
  pan_number?: string | null;
  aadhaar_number?: string | null;
  gender?: string | null;
  father_name?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  annual_income?: string | null;
  nominee_name?: string | null;
  nominee_relation?: string | null;
  nominee_dob?: string | null;
  vkyc_status?: 'Completed' | 'Pending' | 'Scheduled' | null;
  signature_data?: string | null;
  avatar_data?: string | null;
  card_pin?: string | null;
}

export interface KycVerificationRecord {
  verification_id: string;
  customer_id: string;
  document_type: 'PAN_CARD' | 'AADHAAR_UIDAI' | 'VIDEO_KYC' | 'DIGITAL_SIGNATURE' | 'MOBILE_OTP';
  document_number?: string | null;
  verification_method: string;
  status: 'Verified' | 'Pending' | 'Failed';
  verified_at?: string;
  remarks?: string | null;
}


export interface Account {
  account_number: string;
  customer_id: string;
  account_type: 'Savings Account' | 'Current Account' | 'Salary Account' | 'Student Savings' | 'Fixed Deposit';
  balance: number;
  ifsc_code: string;
  branch_name: string;
  opening_date: string;
  status: 'Active' | 'Frozen' | 'Closed';
  customer_name?: string;
  card_pin?: string | null;
}

export interface Beneficiary {
  beneficiary_id: string;
  customer_id: string;
  beneficiary_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  transfer_limit: number;
  cooling_until?: string | null;
  created_at?: string;
  is_active?: number;
}

export interface Deposit {
  deposit_id: string;
  customer_id: string;
  linked_account: string;
  deposit_type: 'Fixed Deposit' | 'Recurring Deposit';
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  maturity_amount: number;
  maturity_date: string;
  status: 'Active' | 'Matured' | 'Liquidated';
  created_at?: string;
}

export interface Transaction {
  transaction_id: string;
  sender_account: string | null;
  receiver_account: string | null;
  amount: number;
  type: 'Deposit' | 'Withdrawal' | 'Transfer';
  date_time: string;
  status: 'Success' | 'Pending' | 'Failed';
  description: string;
  flow?: 'Credit' | 'Debit' | 'Self Transfer';
}

export interface AuthUser {
  customer_id: string;
  full_name: string;
  email: string;
  role?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  customer: Customer;
  accounts?: Account[];
}

