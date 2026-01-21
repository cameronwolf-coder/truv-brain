# Outreach Intelligence

HubSpot-based sales intelligence tool for identifying and scoring dormant contacts.

## Setup

1. Create virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r outreach_intel/requirements.txt
   ```

3. Configure HubSpot token:
   ```bash
   cp .env.example .env
   # Edit .env and add your HubSpot private app token
   ```

## Usage

### CLI Commands

**Get dormant contacts:**
```bash
python -m outreach_intel.cli dormant --limit 25
python -m outreach_intel.cli dormant --limit 50 --industry "Mortgage"
python -m outreach_intel.cli dormant --json  # JSON output
```

**Get closed-lost contacts:**
```bash
python -m outreach_intel.cli closed-lost --limit 25
```

**Get churned customers:**
```bash
python -m outreach_intel.cli churned --limit 25
```

**Create HubSpot list:**
```bash
python -m outreach_intel.cli create-list dormant "Q1 Re-engagement Campaign" --limit 50
```

### Python API

```python
from outreach_intel import OutreachService

service = OutreachService()

# Get scored dormant contacts
contacts = service.get_dormant_contacts(limit=50)
for contact in contacts[:10]:
    print(f"{contact.name}: {contact.total_score}")

# Get closed-lost for re-engagement
closed_lost = service.get_closed_lost(limit=25)

# Create a HubSpot list
service.create_campaign_list(contacts[:25], "My Campaign List")
```

## Scoring

Contacts are scored on four dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Engagement | 25% | Email opens, clicks, recent activity |
| Timing | 25% | Days since last contact, seasonality |
| Deal Context | 30% | Lifecycle stage, how far they got |
| External Triggers | 20% | Job changes, company news |

## Exclusions

These lifecycle stages are excluded (active customers):
- Implementing Customer
- Live Customer
- Indirect Customer
- Customer
- Advocate
- Disqualified / Opt-Out
- Open Deal / Opportunity

## Running Tests

```bash
pytest tests/ -v
pytest tests/ -v -m integration  # Integration tests only
```
