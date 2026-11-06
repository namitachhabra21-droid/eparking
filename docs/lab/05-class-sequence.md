# Experiment 5 — UML Class Diagram & Sequence Diagrams

## Aim
Model ParkFlow's static structure (classes and relationships) and the order of
messages in its key interactions.

## 1. Class diagram — domain model

```mermaid
classDiagram
  direction LR
  class Facility {
    +id: String  «L1..L4»
    +name: String
    +addr: String
    +zones: String[]
    +cap: int
    +rate: int  «₹/hr»
    +freeBays() int
  }
  class Slot {
    +id: String  «L1-A07»
    +zone: String
    +num: int
    +floor: int
    +type: SlotType
    +status: SlotStatus
    +since: DateTime
    +plate: String
    +reserve(plate)
    +release()
  }
  class Session {
    +id: String  «SES-9001»
    +user: String
    +plate: String
    +vehicle: String
    +start: DateTime
    +mins: int
    +rate: int
    +amount: int
    +status: SessionStatus
    +method: PaymentMethod
    +ev: bool
    +fare() int
    +extend(hours)
    +checkOut()
  }
  class Reservation {
    +id: String  «RSV-4201»
    +user: String
    +plate: String
    +at: DateTime
    +hours: int
    +amount: int
    +status: ReservationStatus
    +channel: String
    +checkIn()
    +cancel()
  }
  class Customer {
    +id: String
    +name: String
    +email: String
    +plan: Plan
    +visits: int
    +spend: int
    +status: String
  }
  class Alert {
    +id: String
    +sev: Severity
    +title: String
    +body: String
    +at: DateTime
    +ack: bool
    +acknowledge()
  }
  class Staff {
    +id: String
    +name: String
    +role: String
    +shift: String
    +status: String
  }
  class SlotType {
    <<enumeration>>
    std
    ev
    acc
  }
  class SlotStatus {
    <<enumeration>>
    free
    reserved
    occupied
  }

  Facility "1" *-- "1..*" Slot : contains
  Facility "1" o-- "0..*" Staff : employs
  Facility "1" -- "0..*" Alert : raises
  Slot "1" -- "0..1" Session : active session
  Slot "1" -- "0..*" Reservation : booked for
  Customer "1" -- "0..*" Session : parks
  Customer "1" -- "0..*" Reservation : makes
  Slot ..> SlotType
  Slot ..> SlotStatus
```

## 2. Class diagram — software (module) design

ParkFlow uses ES modules rather than classes. Each module is modelled as a class
whose members are its exported functions.

```mermaid
classDiagram
  class App {
    -state: route, lot, theme, collapsed
    -ROUTES: Map
    +navigate(route, force)
    +updateMeter()
    +commandPalette()
    +setTheme(t)
  }
  class Store {
    <<module core/store.js>>
    +DB: slots, sessions, reservations, customers, alerts, staff, series, activity
    +LOTS: Facility[]
    +metrics(lotId) Metrics
    +subscribe(fn) unsubscribe
    +startLive()
    +stopLive()
    +pushActivity() Activity
    +money(n) / compact(n) / dur(m) / ago(t)
  }
  class UI {
    <<module core/ui.js>>
    +el(html) / qs / qsa / esc
    +toast(title, body, tone)
    +modal(opts) close
    +areaChart() / barChart() / donut() / sparkline()
  }
  class DataTable {
    <<module core/datatable.js>>
    +dataTable(host, rows, cols, search, filters, pageSize, onRow)
    -view() rows
    -paint()
  }
  class View {
    <<interface>>
    +render(root, ctx) cleanup
  }
  class BookingWizard {
    +openBooking(onDone)
  }
  class Icons { +icon(name) }

  App --> Store
  App --> UI
  App --> BookingWizard
  App --> "9" View : routes to
  View <|.. Dashboard
  View <|.. LotMap
  View <|.. Sessions
  View <|.. Bookings
  View <|.. Customers
  View <|.. Analytics
  View <|.. Alerts
  View <|.. StaffView
  View <|.. Settings
  View --> Store
  View --> UI
  Sessions --> DataTable
  Bookings --> DataTable
  Customers --> DataTable
  StaffView --> DataTable
  BookingWizard --> Store
  DataTable --> UI
  UI --> Icons
```

Design notes: every **View** implements the same `render(root, ctx)` contract, so the
router can treat them uniformly (Strategy pattern). **Store** is a single source of
truth with publish/subscribe (Observer pattern).

## 3. Sequence diagram — Book a Bay (UC-4)

```mermaid
sequenceDiagram
  actor A as Attendant
  participant V as Bookings View
  participant W as BookingWizard
  participant S as Store (DB)
  participant P as Payment Gateway
  participant U as UI (toast)

  A->>V: click "New Reservation"
  V->>W: openBooking(onDone)
  W->>S: count free slots per facility
  W-->>A: Step 1 – facilities, free count, rate
  A->>W: select facility, Continue
  W->>S: free slots in facility (≤ 24)
  W-->>A: Step 2 – bay grid, duration
  A->>W: Continue (no bay)
  W->>U: toast("Pick a bay", warn)
  A->>W: select bay, duration, Continue
  W-->>A: Step 3 – details + total = rate × hours
  A->>W: name, plate, method, Confirm & Pay
  W->>P: authorise(amount, method)
  P-->>W: approved
  W->>S: slot.status = reserved
  W->>S: reservations.unshift(RSV)
  W->>U: toast("Booking confirmed")
  W->>V: onDone() → re-render
```

## 4. Sequence diagram — live update tick (UC-14)

```mermaid
sequenceDiagram
  participant T as setInterval (4 s)
  participant S as Store
  participant M as LotMap View
  participant A as App (rail meter)

  Note over M,A: subscribe() called on render
  loop every 4000 ms
    T->>S: tick
    S->>S: flip 1–3 random slots
    S->>S: recompute mins & amount of active sessions
    opt rnd > 0.45
      S->>S: pushActivity()
      S-->>M: emit {type:"activity"}
    end
    S-->>M: emit {type:"tick"}
    M->>S: read DB.slots, metrics()
    M->>M: repaint bays
    S-->>A: emit {type:"tick"}
    A->>S: metrics(lot)
    A->>A: update Estate Load %
  end
```

## 5. Sequence diagram — search & filter sessions (UC-6)

```mermaid
sequenceDiagram
  actor U as User
  participant D as DataTable
  participant R as rows[]
  U->>D: type "MH 12" in search
  D->>D: q = "MH 12", page = 1
  D->>R: filter(search keys contain q)
  D->>R: apply select filters
  D->>D: sort by sortKey × sortDir
  D->>D: slice(page) and render <tr>s
  D-->>U: "N records", "Showing 1–12 of N"
```
