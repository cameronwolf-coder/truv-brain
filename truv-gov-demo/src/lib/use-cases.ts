export interface UseCase {
  key: string;
  name: string;
  shortName: string;
  productType: string;
  icon: string;
  description: string;
  govDescription: string;
  howItWorks: { step: number; title: string; description: string }[];
  govUseCases: string[];
  complianceBadges: string[];
}

export const USE_CASES: UseCase[] = [
  {
    key: "voie",
    name: "Income & Employment Verification",
    shortName: "VOIE",
    productType: "income",
    icon: "💰",
    description: "Verify income and employment data directly from payroll systems.",
    govDescription:
      "Instantly verify income and employment for benefits eligibility determinations, contractor onboarding, and means-tested program enrollment — eliminating manual document review.",
    howItWorks: [
      { step: 1, title: "Initiate Verification", description: "Applicant connects their employer or payroll provider through Truv Bridge." },
      { step: 2, title: "Data Retrieved", description: "Truv pulls income, employment dates, and pay history directly from the payroll system." },
      { step: 3, title: "Report Delivered", description: "Structured verification report returned in real-time with employer name, title, income, and pay stubs." },
    ],
    govUseCases: [
      "Benefits eligibility determination (SNAP, Medicaid, TANF)",
      "Federal contractor income verification",
      "Means-tested program enrollment",
      "Housing assistance qualification (HUD Section 8)",
      "SBA loan applicant verification",
    ],
    complianceBadges: ["SOC 2 Type II", "FCRA Compliant", "FedRAMP Ready"],
  },
  {
    key: "voe",
    name: "Employment History Verification",
    shortName: "VOE",
    productType: "employment",
    icon: "🏛️",
    description: "Verify current and historical employment records.",
    govDescription:
      "Verify employment history for security clearances, background investigations, and federal hiring — with direct payroll system connections covering 96% of the US workforce.",
    howItWorks: [
      { step: 1, title: "Initiate Verification", description: "Subject connects their employer through Truv Bridge for employment history check." },
      { step: 2, title: "Records Retrieved", description: "Truv pulls employment dates, titles, and status directly from HR/payroll systems." },
      { step: 3, title: "Report Delivered", description: "Structured employment history report with employer name, title, dates, and employment status." },
    ],
    govUseCases: [
      "Security clearance background investigations",
      "Federal employee hiring verification (SF-86)",
      "Military service verification",
      "Law enforcement background checks",
      "Government contractor compliance",
    ],
    complianceBadges: ["SOC 2 Type II", "FCRA Compliant", "ITAR Compatible"],
  },
  {
    key: "dds",
    name: "Direct Deposit Switch",
    shortName: "DDS",
    productType: "deposit_switch",
    icon: "🏦",
    description: "Switch direct deposit allocation to a new account.",
    govDescription:
      "Streamline federal employee onboarding with automated direct deposit setup — eliminating paper SF-1199A forms and reducing payroll processing time from weeks to minutes.",
    howItWorks: [
      { step: 1, title: "Enter Account Info", description: "Employee provides new bank account details (routing + account number)." },
      { step: 2, title: "Connect Payroll", description: "Employee authenticates with their payroll provider via Truv Bridge." },
      { step: 3, title: "Deposit Switched", description: "Direct deposit allocation automatically updated in the payroll system." },
    ],
    govUseCases: [
      "Federal employee onboarding (replace SF-1199A)",
      "Military PCS (Permanent Change of Station) relocations",
      "TSP contribution routing changes",
      "GS pay grade transitions",
      "Contractor payment setup",
    ],
    complianceBadges: ["SOC 2 Type II", "Bank-Level Encryption", "NACHA Compliant"],
  },
  {
    key: "voa",
    name: "Verification of Assets",
    shortName: "VOA",
    productType: "assets",
    icon: "📊",
    description: "Verify bank account balances and transaction history.",
    govDescription:
      "Verify applicant assets for means-tested benefits, FHA/VA loan qualification, and financial disclosure requirements — with real-time balance and transaction data.",
    howItWorks: [
      { step: 1, title: "Connect Accounts", description: "Applicant connects their financial institution(s) through Truv Bridge." },
      { step: 2, title: "Data Retrieved", description: "Truv pulls account balances, types, and transaction history from the institution." },
      { step: 3, title: "Report Delivered", description: "Structured asset report with account details, balances, and recent transactions." },
    ],
    govUseCases: [
      "FHA/VA loan asset verification",
      "Means-tested benefit eligibility (asset limits)",
      "Financial disclosure verification (OGE-278e)",
      "Small Business Administration loan review",
      "Federal grant applicant financial review",
    ],
    complianceBadges: ["SOC 2 Type II", "FCRA Compliant", "GSE Accepted"],
  },
  {
    key: "insurance",
    name: "Insurance Verification",
    shortName: "Insurance",
    productType: "insurance",
    icon: "🛡️",
    description: "Verify active insurance policies and coverage details.",
    govDescription:
      "Verify insurance coverage for FHA/VA loan compliance, government fleet management, and contractor insurance requirements — with real-time policy status and coverage limits.",
    howItWorks: [
      { step: 1, title: "Connect Insurer", description: "Applicant connects their insurance provider through Truv Bridge." },
      { step: 2, title: "Policy Retrieved", description: "Truv pulls policy status, coverage types, limits, and effective dates." },
      { step: 3, title: "Report Delivered", description: "Structured insurance report with policy details, coverage limits, and deductibles." },
    ],
    govUseCases: [
      "FHA/VA loan insurance compliance",
      "Government fleet insurance management",
      "Federal contractor insurance requirements",
      "Military housing insurance verification",
      "Disaster relief insurance validation (FEMA)",
    ],
    complianceBadges: ["SOC 2 Type II", "ACORD Compliant", "State DOI Aligned"],
  },
  {
    key: "pll",
    name: "Paycheck Linked Lending",
    shortName: "PLL",
    productType: "pll",
    icon: "💳",
    description: "Set up automatic paycheck deductions for loan repayment.",
    govDescription:
      "Enable automatic payroll deductions for federal student loan repayment, TSP loan payback, and government-sponsored lending programs — reducing default rates and administrative overhead.",
    howItWorks: [
      { step: 1, title: "Enter Loan Details", description: "Borrower provides repayment account and allocation details." },
      { step: 2, title: "Connect Payroll", description: "Borrower authenticates with their payroll provider via Truv Bridge." },
      { step: 3, title: "Deduction Set", description: "Automatic payroll deduction configured for loan repayment." },
    ],
    govUseCases: [
      "Federal student loan Income-Driven Repayment",
      "TSP (Thrift Savings Plan) loan repayment",
      "Military allotment setup",
      "Government-backed small business loan repayment",
      "PSLF (Public Service Loan Forgiveness) payment tracking",
    ],
    complianceBadges: ["SOC 2 Type II", "NACHA Compliant", "CFPB Aligned"],
  },
  {
    key: "admin",
    name: "Admin Actions",
    shortName: "Admin",
    productType: "admin",
    icon: "⚙️",
    description: "Access workforce data for headcount and payroll reporting.",
    govDescription:
      "Pull real-time workforce data for headcount audits, payroll compliance checks, and organizational reporting — enabling agencies to verify contractor workforce claims and monitor labor compliance.",
    howItWorks: [
      { step: 1, title: "Connect Payroll System", description: "Authorized admin connects the organization's payroll provider via Truv Bridge." },
      { step: 2, title: "Workforce Data Retrieved", description: "Truv pulls employee roster, pay rates, departments, and employment status." },
      { step: 3, title: "Report Delivered", description: "Structured workforce report with employee details, pay information, and org structure." },
    ],
    govUseCases: [
      "Federal contractor headcount verification",
      "Davis-Bacon Act prevailing wage compliance",
      "Service Contract Act labor standards audit",
      "Government agency workforce analytics",
      "SBA size standard employee count verification",
    ],
    complianceBadges: ["SOC 2 Type II", "FISMA Compatible", "FedRAMP Ready"],
  },
];
