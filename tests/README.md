# Test Suite

Tests for the Outreach Intelligence tool and related components.

## Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_scorer.py -v

# Run integration tests only (requires HubSpot token)
pytest tests/ -v -m integration

# Run with coverage
pytest tests/ --cov=outreach_intel --cov-report=html
```

---

## Test Files

| File | What It Tests |
|------|---------------|
| `test_scorer.py` | Contact scoring logic and weights |
| `test_hubspot_client.py` | HubSpot API client methods |
| `test_service.py` | OutreachService query methods |
| `test_config.py` | Configuration loading |
| `test_integration.py` | End-to-end integration with HubSpot |

---

## Test Categories

### Unit Tests (default)

Test individual functions and classes in isolation. No external dependencies.

```bash
pytest tests/ -v
```

### Integration Tests

Test actual HubSpot API integration. Requires `HUBSPOT_ACCESS_TOKEN` environment variable.

```bash
pytest tests/ -v -m integration
```

---

## Writing Tests

### Naming Convention

```python
def test_<function_name>_<scenario>_<expected_result>():
    # test_score_contact_with_recent_email_returns_high_engagement()
```

### Test Structure

```python
def test_example():
    # Arrange
    contact = {"id": "123", "properties": {...}}

    # Act
    result = scorer.score_contact(contact)

    # Assert
    assert result.total_score > 50
```

### Fixtures

Common fixtures in `conftest.py`:
- `sample_contact` — Basic contact dict
- `hubspot_client` — Configured HubSpot client (integration tests)

---

## Coverage

Current coverage targets:
- `scorer.py` — 90%+
- `hubspot_client.py` — 80%+
- `service.py` — 80%+

Generate coverage report:
```bash
pytest tests/ --cov=outreach_intel --cov-report=html
open htmlcov/index.html
```
