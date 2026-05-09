# Улучшения проекта warhouse по документации wms_analysis

## 🔴 Фаза 1 — Критические исправления

### 1. Транзакции + защита от Race Condition
**Файл:** `backend/src/services/StockService.js` (новый)
- Единый сервис `adjustStock()` для всех изменений остатков
- Использует `FOR UPDATE NOWAIT` (блокировка строки на уровне БД)
- Защита от отрицательных остатков с понятным сообщением об ошибке
- Автоматически пишет запись в `StockMovement` (история движений)

### 2. Исправлено двойное списание (POS → Issue)
**Файл:** `backend/src/routes/pos.js`
- POS-продажи теперь создают `Sale` (отдельная модель), а не `Issue`
- `issues.js` — только для ручных списаний (не касса)
- Исключена возможность повторного списания через confirm

### 3. Сохранение цены продажи в базе
**Схема:** `SaleItem.salePrice`, `SaleItem.costPrice`
- Цена и себестоимость фиксируются на момент продажи
- Финансовые отчёты теперь отражают реальные данные

### 4. idempotencyKey — защита от дублей
**Файл:** `backend/src/routes/pos.js`
- Поле `Sale.idempotencyKey` (уникальный индекс)
- При повторном запросе с тем же ключом — возвращается существующая продажа
- Фронтенд генерирует ключ: `${warehouseId}-${Date.now()}-${random}`

## 🟠 Фаза 2 — Ключевая бизнес-логика

### 5. Кассовые смены (Shift)
**Файл:** `backend/src/routes/shifts.js` (новый)
- `POST /api/shifts/open` — открыть смену с начальной суммой наличных
- `GET /api/shifts/current` — текущая смена + X-отчёт
- `GET /api/shifts/:id/x-report` — промежуточный отчёт без закрытия
- `POST /api/shifts/:id/cash-op` — инкассация / расход / пополнение
- `POST /api/shifts/:id/close` — Z-отчёт, расчёт расхождения наличных

### 6. Возвраты (Return)
**Файл:** `backend/src/routes/returns.js` (новый)
- Возврат по чеку (до 14 дней — кассир, после — менеджер)
- Возврат без чека — только admin/manager
- Автоматическое восстановление остатков через StockService
- Условие товара: `good` / `damaged` / `written_off`

### 7. Двухэтапные перемещения (Transfer)
**Файл:** `backend/src/routes/transfers.js`
- `POST /:id/send` — отправить (draft → in_transit), списание с источника
- `POST /:id/receive` — принять с фактическими qty (→ received / partially_received)
- Частичная приёмка с записью расхождений в `TransferItem.discrepancy`
- Зачисление на склад получателя только при реальной приёмке

### 8. Размеры обуви
**Схема:** `Product.size`, `brand`, `modelCode`, `gender`, `season`, `barcode`
- Каждый размер = отдельный SKU, объединены через `modelCode`
- `GET /api/pos/product/:id` возвращает все доступные размеры модели (`siblings`)
- `GET /api/products/model/:modelCode` — все размеры модели с остатками

## 📐 Новая архитектура БД

### Новые модели
| Модель | Назначение |
|--------|-----------|
| `Sale` | POS-продажи (отдельно от Issue) |
| `SaleItem` | Позиции с salePrice + costPrice |
| `Shift` | Кассовые смены |
| `CashOperation` | Инкассация, расходы, пополнения |
| `Return` | Возвраты товара |
| `ReturnItem` | Позиции возврата |
| `StockMovement` | История всех движений остатков |
| `Inventory` | Инвентаризация |
| `InventoryItem` | Позиции инвентаризации |

### Изменения в существующих моделях
- `Product`: добавлены `barcode`, `modelCode`, `brand`, `size`, `gender`, `season`, `costPrice`, `salePrice`, `isActive`
- `Transfer`: двухэтапный (`sentAt`, `receivedAt`, `confirmedBy`)
- `TransferItem`: `sentQty`, `receivedQty`, `discrepancy`
- `Stock`: добавлено `reserved` (для будущего резервирования)
- `User.role`: расширен ('cashier', 'warehouse', 'analyst')

## 🔗 Новые API эндпоинты

```
POST   /api/pos/sale               — Продажа (атомарная, с idempotencyKey)
GET    /api/pos/sales              — История продаж
GET    /api/pos/product/:id        — Товар + все размеры модели

POST   /api/shifts/open            — Открыть смену
GET    /api/shifts/current         — Текущая смена + X-отчёт
GET    /api/shifts/:id/x-report    — X-отчёт
POST   /api/shifts/:id/cash-op     — Кассовая операция
POST   /api/shifts/:id/close       — Закрыть смену (Z-отчёт)

POST   /api/returns                — Создать возврат
GET    /api/returns                — Список возвратов
GET    /api/returns/:id            — Детали

POST   /api/transfers/:id/send     — Отправить товар
POST   /api/transfers/:id/receive  — Принять товар

POST   /api/inventory              — Создать инвентаризацию
POST   /api/inventory/:id/start    — Начать
POST   /api/inventory/:id/scan     — Сканировать товар
POST   /api/inventory/:id/complete — Завершить и применить

GET    /api/reports/analytics/sales-by-size  — Продажи по размерам
GET    /api/reports/analytics/margin         — Маржинальность по SKU
GET    /api/reports/analytics/slow-movers    — Медленно продаваемые товары
GET    /api/products/model/:modelCode        — Все размеры модели
```

## 🚀 Миграция БД

После применения нового schema.prisma:
```bash
npx prisma migrate dev --name add_sale_shift_return_inventory
```

Для Railway production:
```bash
npx prisma migrate deploy
```
