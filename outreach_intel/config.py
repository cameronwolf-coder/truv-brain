"""Configuration for Outreach Intelligence."""

# Lifecycle stages to EXCLUDE (active customers, open deals, disqualified)
EXCLUDED_LIFECYCLE_STAGES = [
    "opportunity",      # Open Deal
    "1154636674",       # Opportunity
    "customer",         # Implementing Customer
    "268792390",        # Live Customer
    "1012659574",       # Indirect Customer
    "1154761341",       # Customer
    "1070076549",       # Advocate
    "other",            # Disqualified / Opt-Out
]

# Lifecycle stages to INCLUDE (dormant prospects, closed lost, churned)
INCLUDED_LIFECYCLE_STAGES = [
    "subscriber",           # New
    "lead",                 # Lead
    "marketingqualifiedlead",  # MQL
    "salesqualifiedlead",   # SAL
    "268636563",            # Closed Lost
    "268798100",            # Churned Customer
]

# Closed Won deal stage IDs (contacts with these are customers)
CLOSED_WON_DEAL_STAGES = [
    "1f7d22d8-b3fd-4918-82c3-ddaa9bdb8a52",  # Enterprise Sales
    "1092340356",                              # Self-Service
    "979907381",                               # Renewals
]

# Default properties to fetch for contacts
DEFAULT_CONTACT_PROPERTIES = [
    # Basic info
    "firstname",
    "lastname",
    "email",
    "jobtitle",
    # Company
    "company",
    "industry",
    "sales_vertical",
    # Status
    "lifecyclestage",
    "hs_lead_status",
    # Engagement
    "notes_last_updated",
    "hs_email_last_open_date",
    "hs_email_last_click_date",
    # Tech stack (mortgage)
    "mortgage_los__new_",
    "mortgage_pos__new_",
    # Volume
    "mortgage_loan_volume",
]


def get_exclusion_filters() -> list[dict]:
    """Get HubSpot search filters to exclude active customers.

    Returns:
        List of filter objects for HubSpot search API
    """
    return [
        {
            "propertyName": "lifecyclestage",
            "operator": "NOT_IN",
            "values": EXCLUDED_LIFECYCLE_STAGES,
        }
    ]


def get_inclusion_filters() -> list[dict]:
    """Get HubSpot search filters for target lifecycle stages.

    Returns:
        List of filter objects for HubSpot search API
    """
    return [
        {
            "propertyName": "lifecyclestage",
            "operator": "IN",
            "values": INCLUDED_LIFECYCLE_STAGES,
        }
    ]
