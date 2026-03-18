"""Test lead profiles for Truv Scout evaluation.

Each entry mirrors a HubSpot contact record with form properties.
Used by the grader to verify scorer + routing deterministically.
"""

TEST_LEADS = [
    # ── 1. Enterprise Mortgage Executive ─────────────────────────────
    {
        "name": "Enterprise Mortgage Executive",
        "contact": {
            "id": "eval-001",
            "properties": {
                "firstname": "Sarah",
                "lastname": "Chen",
                "email": "sarah.chen@lendingcorp.com",
                "jobtitle": "VP of Lending Operations",
                "company": "LendingCorp",
                "lifecyclestage": "lead",
                "use_case": "Mortgage",
                "which_of_these_best_describes_your_job_title_": "VP",
                "how_many_loans_do_you_close_per_year": "30,000-100,000",
                "how_many_applications_do_you_see_per_year_": "100,000+",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "warm",
        "description": "VP at large mortgage lender with high volume — clear enterprise",
    },
    # ── 2. Enterprise Director ───────────────────────────────────────
    {
        "name": "Enterprise Director",
        "contact": {
            "id": "eval-002",
            "properties": {
                "firstname": "Marcus",
                "lastname": "Rivera",
                "email": "m.rivera@consumerfinco.com",
                "jobtitle": "Director of Underwriting",
                "company": "ConsumerFinCo",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "Director",
                "how_many_loans_do_you_close_per_year": "10,000-30,000",
                "how_many_applications_do_you_see_per_year_": "50,000-100,000",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "warm",
        "description": "Director at consumer lender with 50K apps — enterprise by role",
    },
    # ── 3. Enterprise High Volume ────────────────────────────────────
    {
        "name": "Enterprise High Volume",
        "contact": {
            "id": "eval-003",
            "properties": {
                "firstname": "David",
                "lastname": "Park",
                "email": "dpark@megaloans.com",
                "jobtitle": "Operations Manager",
                "company": "MegaLoans Inc",
                "lifecyclestage": "lead",
                "use_case": "Mortgage",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_loans_do_you_close_per_year": "50,000-100,000",
                "how_many_applications_do_you_see_per_year_": "100,000+",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "warm",
        "description": "Manager title but 50K+ loans — enterprise by volume alone",
    },
    # ── 4. Self-Service Small Fintech ────────────────────────────────
    {
        "name": "Self-Service Small Fintech",
        "contact": {
            "id": "eval-004",
            "properties": {
                "firstname": "Amy",
                "lastname": "Liu",
                "email": "amy@quicklend.io",
                "jobtitle": "Product Manager",
                "company": "QuickLend",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_loans_do_you_close_per_year": "1,000-5,000",
                "how_many_applications_do_you_see_per_year_": "5,000-10,000",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Manager at small fintech with 5K apps — self-service",
    },
    # ── 5. Self-Service IC ───────────────────────────────────────────
    {
        "name": "Self-Service IC",
        "contact": {
            "id": "eval-005",
            "properties": {
                "firstname": "Jordan",
                "lastname": "Blake",
                "email": "jblake@startuplend.com",
                "jobtitle": "Software Engineer",
                "company": "StartupLend",
                "lifecyclestage": "lead",
                "use_case": "Mortgage",
                "which_of_these_best_describes_your_job_title_": "Individual Contributor",
                "how_many_loans_do_you_close_per_year": "500-1,000",
                "how_many_applications_do_you_see_per_year_": "1,000-5,000",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "IC at small startup with low volume — self-service",
    },
    # ── 6. Government ────────────────────────────────────────────────
    {
        "name": "Government",
        "contact": {
            "id": "eval-006",
            "properties": {
                "firstname": "Patricia",
                "lastname": "Gomez",
                "email": "pgomez@state.gov.example",
                "jobtitle": "Program Director",
                "company": "State Housing Authority",
                "lifecyclestage": "lead",
                "use_case": "Public Services",
                "which_of_these_best_describes_your_job_title_": "Director",
                "how_many_applications_do_you_see_per_year_": "10,000-30,000",
            },
        },
        "expected_routing": "government",
        "expected_tier_min": "cold",
        "description": "Public Services use case — government routing regardless of role",
    },
    # ── 7. Not-a-Lead Login ──────────────────────────────────────────
    {
        "name": "Not-a-Lead Login",
        "contact": {
            "id": "eval-007",
            "properties": {
                "firstname": "Test",
                "lastname": "User",
                "email": "testuser@gmail.com",
                "jobtitle": "",
                "company": "",
                "lifecyclestage": "subscriber",
                "how_can_we_help": "Log in to Truv",
            },
        },
        "expected_routing": "not-a-lead",
        "expected_tier_min": "cold",
        "description": "Came to log in, not a real lead",
    },
    # ── 8. Not-a-Lead Verification Help ──────────────────────────────
    {
        "name": "Not-a-Lead Verification Help",
        "contact": {
            "id": "eval-008",
            "properties": {
                "firstname": "Lisa",
                "lastname": "Tran",
                "email": "lisa.tran@yahoo.com",
                "jobtitle": "",
                "company": "",
                "lifecyclestage": "subscriber",
                "how_can_we_help": "Verification Help",
            },
        },
        "expected_routing": "not-a-lead",
        "expected_tier_min": "cold",
        "description": "Needs verification help — not a B2B lead",
    },
    # ── 9. Enterprise C-Suite ────────────────────────────────────────
    {
        "name": "Enterprise C-Suite",
        "contact": {
            "id": "eval-009",
            "properties": {
                "firstname": "Robert",
                "lastname": "Nakamura",
                "email": "rnakamura@primemortgage.com",
                "jobtitle": "Chief Operating Officer",
                "company": "PrimeMortgage",
                "lifecyclestage": "lead",
                "use_case": "Mortgage",
                "which_of_these_best_describes_your_job_title_": "C-Suite",
                "how_many_loans_do_you_close_per_year": "10,000-30,000",
                "how_many_applications_do_you_see_per_year_": "30,000-50,000",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "warm",
        "description": "C-Suite at mortgage company — always enterprise",
    },
    # ── 10. Enterprise SVP ───────────────────────────────────────────
    {
        "name": "Enterprise SVP",
        "contact": {
            "id": "eval-010",
            "properties": {
                "firstname": "Katherine",
                "lastname": "Wells",
                "email": "kwells@autofinance.com",
                "jobtitle": "SVP of Risk",
                "company": "AutoFinance Corp",
                "lifecyclestage": "lead",
                "use_case": "Auto Lending",
                "which_of_these_best_describes_your_job_title_": "SVP",
                "how_many_loans_do_you_close_per_year": "5,000-10,000",
                "how_many_applications_do_you_see_per_year_": "30,000-50,000",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "cold",
        "description": "SVP at auto lender — enterprise by role",
    },
    # ── 11. Self-Service HR Platform ─────────────────────────────────
    {
        "name": "Self-Service HR Platform",
        "contact": {
            "id": "eval-011",
            "properties": {
                "firstname": "Emily",
                "lastname": "Foster",
                "email": "efoster@hrtechco.com",
                "jobtitle": "HR Operations Manager",
                "company": "HRTechCo",
                "lifecyclestage": "lead",
                "use_case": "Employment Verification",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_applications_do_you_see_per_year_": "1,000-5,000",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Manager at HR platform with 2K apps — self-service",
    },
    # ── 12. Warm Fintech Lead ────────────────────────────────────────
    {
        "name": "Warm Fintech Lead",
        "contact": {
            "id": "eval-012",
            "properties": {
                "firstname": "Carlos",
                "lastname": "Mendez",
                "email": "cmendez@neobank.io",
                "jobtitle": "Head of Lending",
                "company": "NeoBank",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_loans_do_you_close_per_year": "5,000-10,000",
                "how_many_applications_do_you_see_per_year_": "8,000-10,000",
                "hs_email_last_click_date": "2026-03-10T14:00:00Z",
                "num_conversion_events": "3",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "cold",
        "description": "Manager at fintech with 5K-10K loans (>3K threshold) — enterprise by volume",
    },
    # ── 13. Cold No-Form ─────────────────────────────────────────────
    {
        "name": "Cold No-Form",
        "contact": {
            "id": "eval-013",
            "properties": {
                "firstname": "Unknown",
                "lastname": "Contact",
                "email": "noform@example.com",
                "jobtitle": "",
                "company": "",
                "lifecyclestage": "subscriber",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Subscriber with no form data — cold self-service default",
    },
    # ── 14. Hot Closed Lost Re-Engage ────────────────────────────────
    {
        "name": "Hot Closed Lost Re-Engage",
        "contact": {
            "id": "eval-014",
            "properties": {
                "firstname": "James",
                "lastname": "Whitfield",
                "email": "jwhitfield@creditunion.org",
                "jobtitle": "VP of Operations",
                "company": "National Credit Union",
                "lifecyclestage": "other",
                "hs_lead_status": "Closed Lost",
                "use_case": "Mortgage",
                "which_of_these_best_describes_your_job_title_": "VP",
                "how_many_loans_do_you_close_per_year": "10,000-30,000",
                "hs_email_last_click_date": "2026-03-11T09:00:00Z",
                "hs_email_last_open_date": "2026-03-12T08:00:00Z",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "cold",
        "description": "Closed lost VP re-engaging via email — enterprise, potentially warm/hot",
    },
    # ── 15. Enterprise by Apollo Override ────────────────────────────
    {
        "name": "Enterprise by Apollo Override",
        "contact": {
            "id": "eval-015",
            "properties": {
                "firstname": "Nina",
                "lastname": "Patel",
                "email": "npatel@bigcorp.com",
                "jobtitle": "Product Manager",
                "company": "BigCorp Financial",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_loans_do_you_close_per_year": "1,000-5,000",
                "how_many_applications_do_you_see_per_year_": "5,000-10,000",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Manager at large company — self-service without enrichment, enterprise with Apollo (500 employees)",
    },
    # ── 16. Tenant Screening ─────────────────────────────────────────
    {
        "name": "Tenant Screening",
        "contact": {
            "id": "eval-016",
            "properties": {
                "firstname": "Rachel",
                "lastname": "Kim",
                "email": "rkim@rentalscreen.com",
                "jobtitle": "Operations Manager",
                "company": "RentalScreen",
                "lifecyclestage": "lead",
                "use_case": "Tenant Screening",
                "which_of_these_best_describes_your_job_title_": "Manager",
                "how_many_applications_do_you_see_per_year_": "1,000-5,000",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Manager at tenant screening company with 3K apps — self-service",
    },
    # ── 17. Background Checks Director ───────────────────────────────
    {
        "name": "Background Checks Director",
        "contact": {
            "id": "eval-017",
            "properties": {
                "firstname": "Thomas",
                "lastname": "Jackson",
                "email": "tjackson@verifynow.com",
                "jobtitle": "Director of Product",
                "company": "VerifyNow",
                "lifecyclestage": "lead",
                "use_case": "Background Checks",
                "which_of_these_best_describes_your_job_title_": "Director",
                "how_many_applications_do_you_see_per_year_": "5,000-10,000",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "cold",
        "description": "Director at background check company — enterprise by role",
    },
    # ── 18. No Use Case Given ────────────────────────────────────────
    {
        "name": "No Use Case Given",
        "contact": {
            "id": "eval-018",
            "properties": {
                "firstname": "Alex",
                "lastname": "Morgan",
                "email": "amorgan@unknownco.com",
                "jobtitle": "Product Manager",
                "company": "UnknownCo",
                "lifecyclestage": "lead",
                "which_of_these_best_describes_your_job_title_": "Manager",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Lead with manager title but no use case or volume — self-service",
    },
    # ── 19. Edge Case Empty Props ────────────────────────────────────
    {
        "name": "Edge Case Empty Props",
        "contact": {
            "id": "eval-019",
            "properties": {
                "email": "bare@example.com",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "Minimal properties — should not crash, defaults to self-service cold",
    },
    # ── 20. Enterprise EVP ───────────────────────────────────────────
    {
        "name": "Enterprise EVP",
        "contact": {
            "id": "eval-020",
            "properties": {
                "firstname": "Margaret",
                "lastname": "O'Brien",
                "email": "mobrien@retailbank.com",
                "jobtitle": "Executive Vice President",
                "company": "RetailBank Holdings",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "EVP",
                "how_many_loans_do_you_close_per_year": "10,000-30,000",
                "how_many_applications_do_you_see_per_year_": "50,000-100,000",
            },
        },
        "expected_routing": "enterprise",
        "expected_tier_min": "warm",
        "description": "EVP at retail bank — enterprise by role",
    },
    # ── 21. Government with Senior Role ──────────────────────────────
    {
        "name": "Government with Senior Role",
        "contact": {
            "id": "eval-021",
            "properties": {
                "firstname": "William",
                "lastname": "Torres",
                "email": "wtorres@county.gov.example",
                "jobtitle": "Deputy Director",
                "company": "County Housing Department",
                "lifecyclestage": "lead",
                "use_case": "Government",
                "which_of_these_best_describes_your_job_title_": "Director",
                "how_many_applications_do_you_see_per_year_": "30,000-50,000",
            },
        },
        "expected_routing": "government",
        "expected_tier_min": "cold",
        "description": "Director at govt agency — government routing overrides enterprise role",
    },
    # ── 22. Self-Service with Engagement ─────────────────────────────
    {
        "name": "Self-Service with Engagement",
        "contact": {
            "id": "eval-022",
            "properties": {
                "firstname": "Priya",
                "lastname": "Sharma",
                "email": "psharma@lendfast.io",
                "jobtitle": "Growth Lead",
                "company": "LendFast",
                "lifecyclestage": "lead",
                "use_case": "Consumer Lending",
                "which_of_these_best_describes_your_job_title_": "Individual Contributor",
                "how_many_loans_do_you_close_per_year": "500-1,000",
                "how_many_applications_do_you_see_per_year_": "1,000-5,000",
                "hs_email_last_open_date": "2026-03-12T10:00:00Z",
                "hs_email_last_click_date": "2026-03-11T15:30:00Z",
                "num_conversion_events": "2",
            },
        },
        "expected_routing": "self-service",
        "expected_tier_min": "cold",
        "description": "IC at small lender with recent engagement — self-service",
    },
]
