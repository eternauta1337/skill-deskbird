# @openclaw/skill-deskbird

Deskbird integration skill for OpenClaw - desk booking and office management.

## Installation

```bash
npm install @openclaw/skill-deskbird
```

Or install globally:

```bash
npm install -g @openclaw/skill-deskbird
```

## Configuration

### Environment Variables

```bash
# Required
DESKBIRD_API_KEY=your-api-key-here

# Optional
DESKBIRD_OFFICE_ID=default-office-uuid
DESKBIRD_BASE_URL=https://connect.deskbird.com
TZ=Europe/Madrid
```

Get your API key from the Deskbird app: **Settings > Integrations > API**

### Config File (optional)

Create `deskbird.json`:

```json
{
  "defaultOfficeId": "your-office-uuid",
  "timezone": "Europe/Madrid"
}
```

## Usage

### List resources and availability

```bash
# Today's availability
deskbird list

# Specific date
deskbird list -d tomorrow
deskbird list -d 2024-03-15

# Filter by type
deskbird list -t flexDesk
deskbird list -t meetingRoom
deskbird list -t parking
```

### Book a resource

```bash
# Book a desk for today
deskbird book "Desk 1"

# Book with specific times
deskbird book "Desk 1" -s 09:00 -e 14:00

# Book for a specific date
deskbird book "Desk 1" -d tomorrow
```

### Cancel a booking

```bash
deskbird cancel "Desk 1"
deskbird cancel "Desk 1" -d tomorrow
```

### View my bookings

```bash
deskbird my
deskbird my -d 30  # Next 30 days
```

### Status (today/tomorrow summary)

```bash
deskbird status
```

### Check in

```bash
deskbird checkin
deskbird checkin "Desk 1"
```

### List offices

```bash
deskbird offices
```

### List all resources

```bash
deskbird resources
deskbird resources -t meetingRoom
```

## OpenClaw Integration

When running inside OpenClaw, the skill automatically uses:

- `OPENCLAW_USER_ID` - Current user ID
- `OPENCLAW_USER_NAME` - Current user name

## API Reference

This skill uses the [Deskbird Public API](https://developer.deskbird.com/):

- `GET /bookings` - List bookings
- `POST /bookings` - Create booking
- `PATCH /bookings/{id}` - Update booking
- `DELETE /bookings/{id}` - Cancel booking
- `GET /resources` - List resources
- `GET /offices` - List offices
- `GET /users` - List users

## License

MIT
