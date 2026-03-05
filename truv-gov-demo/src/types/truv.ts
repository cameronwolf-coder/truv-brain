export interface TruvUser {
  id: string;
  external_user_id: string;
}

export interface BridgeTokenResponse {
  bridge_token: string;
}

export interface LinkAccessToken {
  access_token: string;
  link_id: string;
}

export interface TruvReport {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface IncomeReport extends TruvReport {
  employments: Array<{
    employer: { name: string };
    title: string;
    start_date: string;
    end_date: string | null;
    income: {
      pay_frequency: string;
      base_pay: { amount: number; period: string };
      gross_pay: { amount: number; period: string };
      net_pay: { amount: number; period: string };
    };
    pay_statements: Array<{
      pay_date: string;
      gross_pay: number;
      net_pay: number;
      deductions: Array<{ name: string; amount: number }>;
    }>;
  }>;
}

export interface EmploymentReport extends TruvReport {
  employments: Array<{
    employer: { name: string };
    title: string;
    start_date: string;
    end_date: string | null;
    status: string;
    employment_type: string;
  }>;
}

export interface AssetsReport extends TruvReport {
  accounts: Array<{
    account_name: string;
    account_type: string;
    balance: number;
    currency: string;
    institution: { name: string };
    transactions: Array<{
      date: string;
      description: string;
      amount: number;
      type: string;
    }>;
  }>;
}

export interface InsuranceReport extends TruvReport {
  policies: Array<{
    policy_number: string;
    carrier: string;
    type: string;
    status: string;
    effective_date: string;
    expiration_date: string;
    coverage: Array<{
      type: string;
      limit: number;
      deductible: number;
    }>;
  }>;
}

export interface DepositSwitchReport extends TruvReport {
  deposit_switch: {
    status: string;
    allocation_type: string;
    allocation_value: number;
    account_number_last4: string;
    routing_number: string;
  };
}

export interface PLLReport extends TruvReport {
  paycheck_linked_lending: {
    status: string;
    employer: { name: string };
    pay_frequency: string;
    next_pay_date: string;
    allocation: {
      type: string;
      value: number;
    };
  };
}

export interface AdminReport extends TruvReport {
  employees: Array<{
    first_name: string;
    last_name: string;
    employee_id: string;
    status: string;
    department: string;
    title: string;
    start_date: string;
    pay_rate: number;
    pay_frequency: string;
  }>;
}

// TruvBridge global declaration
export interface TruvBridgeOptions {
  bridgeToken: string;
  onSuccess: (publicToken: string) => void;
  onClose: () => void;
  onError?: (error: string) => void;
  onEvent?: (eventName: string, payload: Record<string, unknown>) => void;
}

export interface TruvBridgeInstance {
  open: () => void;
  close: () => void;
}

declare global {
  const TruvBridge: {
    init: (options: TruvBridgeOptions) => TruvBridgeInstance;
  };
}
