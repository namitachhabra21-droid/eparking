# Experiment 6 — E-R Modelling, State-chart & Activity Modelling

## Aim
Model ParkFlow's data as an E-R diagram, the lifecycles of its key objects as
state charts, and its main workflows as activity diagrams.

## 1. E-R diagram

```mermaid
erDiagram
  FACILITY ||--|{ ZONE : has
  ZONE ||--|{ SLOT : contains
  FACILITY ||--o{ STAFF : employs
  FACILITY ||--o{ ALERT : raises
  FACILITY ||--|| TARIFF : priced_by
  CUSTOMER ||--o{ VEHICLE : owns
  VEHICLE ||--o{ SESSION : parks_in
  SLOT ||--o{ SESSION : hosts
  CUSTOMER ||--o{ RESERVATION : makes
  SLOT ||--o{ RESERVATION : reserved_for
  SESSION ||--o| PAYMENT : settled_by
  RESERVATION ||--o| PAYMENT : prepaid_by

  FACILITY {
    string facility_id PK "L1..L4"
    string name
    string address
    int capacity
  }
  ZONE {
    string zone_id PK
    string facility_id FK
    string code "A,B,C"
    int floor
  }
  SLOT {
    string slot_id PK "L1-A07"
    string zone_id FK
    int number
    enum type "std|ev|acc"
    enum status "free|reserved|occupied"
    datetime since
  }
  TARIFF {
    string facility_id PK, FK
    int hourly_rate
    int min_charge_hours
    int surge_threshold_pct
  }
  CUSTOMER {
    string customer_id PK
    string name
    string email UK
    enum plan "Basic|Plus|Business|Enterprise"
    enum status "active|dormant"
  }
  VEHICLE {
    string plate PK
    string customer_id FK
    string make
    bool is_ev
  }
  SESSION {
    string session_id PK
    string slot_id FK
    string plate FK
    datetime start_time
    datetime end_time
    int amount
    enum status "active|completed|overstay"
  }
  RESERVATION {
    string reservation_id PK
    string customer_id FK
    string slot_id FK
    datetime arrival
    int hours
    int amount
    enum status "pending|confirmed|checked-in|no-show|cancelled"
    string channel
  }
  PAYMENT {
    string payment_id PK
    string ref_id FK "session or reservation"
    int amount
    enum method "UPI|Card|Wallet|FASTag"
    datetime paid_at
  }
  STAFF {
    string staff_id PK
    string facility_id FK
    string name
    string role
    string shift
    enum status "on-duty|off-duty"
  }
  ALERT {
    string alert_id PK
    string facility_id FK
    enum severity "bad|warn|info|ok"
    string title
    datetime raised_at
    bool acknowledged
  }
```

**Relational schema (3NF):**
Facility(**facility_id**, name, address, capacity) ·
Zone(**zone_id**, *facility_id*, code, floor) ·
Slot(**slot_id**, *zone_id*, number, type, status, since) ·
Tariff(***facility_id***, hourly_rate, min_charge_hours, surge_threshold_pct) ·
Customer(**customer_id**, name, email, plan, status) ·
Vehicle(**plate**, *customer_id*, make, is_ev) ·
Session(**session_id**, *slot_id*, *plate*, start_time, end_time, amount, status) ·
Reservation(**reservation_id**, *customer_id*, *slot_id*, arrival, hours, amount, status, channel) ·
Payment(**payment_id**, ref_id, amount, method, paid_at) ·
Staff(**staff_id**, *facility_id*, name, role, shift, status) ·
Alert(**alert_id**, *facility_id*, severity, title, raised_at, acknowledged)

## 2. State-chart diagrams

### 2.1 Parking bay (Slot)

```mermaid
stateDiagram-v2
  [*] --> Free
  Free --> Reserved : reserve() / booking confirmed
  Free --> Occupied : vehicle detected (ANPR)
  Reserved --> Occupied : driver checks in
  Reserved --> Free : release() / no-show / cancel
  Occupied --> Free : check-out / release()
  Free --> Maintenance : hold
  Maintenance --> Free : serviced
  note right of Reserved
    plate set, since = now
  end note
  note right of Free
    plate = null, since = null
  end note
```

### 2.2 Reservation

```mermaid
stateDiagram-v2
  [*] --> Pending : created via partner/API
  [*] --> Confirmed : booking wizard confirm & pay
  Pending --> Confirmed : payment authorised
  Pending --> Cancelled : payment failed / user cancels
  Confirmed --> CheckedIn : driver arrives
  Confirmed --> Cancelled : cancel booking (refund)
  Confirmed --> NoShow : arrival time passed
  CheckedIn --> [*]
  Cancelled --> [*]
  NoShow --> [*]
```

### 2.3 Parking session

```mermaid
stateDiagram-v2
  [*] --> Active : check-in
  state Active {
    [*] --> Accruing
    Accruing --> Accruing : tick / amount = max(rate, round(mins/60 × rate))
  }
  Active --> Active : extend 1h
  Active --> Overstay : end of booked window passed
  Active --> Completed : check-out & pay
  Overstay --> Completed : check-out & pay (with penalty)
  Completed --> [*]
```

### 2.4 Booking wizard (UI)

```mermaid
stateDiagram-v2
  [*] --> Step1_Facility
  Step1_Facility --> Step2_BayTime : Continue
  Step2_BayTime --> Step2_BayTime : Continue [no bay] / toast "Pick a bay"
  Step2_BayTime --> Step3_Confirm : Continue [bay selected]
  Step2_BayTime --> Step1_Facility : Back
  Step3_Confirm --> Step2_BayTime : Back
  Step3_Confirm --> Done : Confirm & Pay
  Step1_Facility --> Closed : Cancel / Esc
  Step2_BayTime --> Closed : Cancel / Esc
  Step3_Confirm --> Closed : Cancel / Esc
  Done --> [*]
  Closed --> [*]
```

## 3. Activity diagrams

### 3.1 Book a bay

```mermaid
flowchart TD
  start((●)) --> A[Open booking wizard]
  A --> B[Select facility]
  B --> C[Show free bays & durations]
  C --> D{Bay selected?}
  D -- No --> E[Show 'Pick a bay' warning] --> C
  D -- Yes --> F[Enter name, plate, payment method]
  F --> G[Show total = rate × hours]
  G --> H{Confirm?}
  H -- Cancel --> X((◉ end))
  H -- Confirm & Pay --> I[Authorise payment]
  I --> J{Approved?}
  J -- No --> F
  J -- Yes --> K[Mark bay reserved]
  K --> L[Create reservation RSV-xxxx]
  L --> M[Show confirmation toast]
  M --> X
```

### 3.2 Vehicle entry → exit (with swim-lanes)

```mermaid
flowchart TD
  subgraph Driver
    d1((●)) --> d2[Arrive at gate]
    d7[Pay at exit] --> d8[Leave]
    d8 --> d9((◉))
  end
  subgraph ANPR_Gate[ANPR / Gate]
    g1[Read plate] --> g2{Reservation found?}
    g6[Open barrier]
  end
  subgraph ParkFlow
    p1[Check in reservation, bay → Occupied]
    p2[Assign free bay, start session]
    p3[Accrue fare every tick]
    p4{Exceeded window?}
    p5[Raise Overstay alert]
    p6[Compute final fare, bay → Free]
  end
  d2 --> g1
  g2 -- Yes --> p1 --> p3
  g2 -- No --> p2 --> p3
  p3 --> p4
  p4 -- Yes --> p5 --> p6
  p4 -- No, driver exits --> p6
  p6 --> d7 --> g6 --> d8
```

### 3.3 Live refresh cycle

```mermaid
flowchart TD
  s((●)) --> t[Wait 4 s]
  t --> f[Pick 1–3 random bays]
  f --> a{Accessible bay?}
  a -- Yes --> n[Skip]
  a -- No --> fr{Free?}
  fr -- Yes --> o[Set occupied/reserved + plate]
  fr -- No --> r{rnd > 0.55?}
  r -- Yes --> fe[Set free]
  r -- No --> n
  o --> p[Re-price active sessions]
  fe --> p
  n --> p
  p --> ev{rnd > 0.45?}
  ev -- Yes --> ac[Push activity event]
  ev -- No --> tk
  ac --> tk[Emit 'tick' to subscribers]
  tk --> t
```
