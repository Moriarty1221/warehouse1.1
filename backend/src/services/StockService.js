class StockError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'StockError';
    this.status = 400;
    this.details = details;
  }
}

async function adjustStock(tx, { productId, warehouseId, delta, type, docType, docId }) {
  const rows = await tx.$queryRaw`
    SELECT id, quantity, "avgCost", reserved
    FROM "Stock"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE NOWAIT
  `;

  const current = rows[0]?.quantity ?? 0;
  const newQty = current + delta;

  if (newQty < 0) {
    const prod = await tx.product.findUnique({ where: { id: productId }, select: { name: true, sku: true } });
    throw new StockError(
      `Недостаточно остатков: "${prod?.name}" (нужно ${-delta}, есть ${current})`,
      { productId, warehouseId, current, needed: -delta }
    );
  }

  if (rows.length > 0) {
    await tx.stock.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { quantity: newQty }
    });
  } else {
    if (delta < 0) throw new StockError(`Нет записи остатка productId=${productId}`);
    await tx.stock.create({ data: { productId, warehouseId, quantity: newQty } });
  }

  await tx.stockMovement.create({
    data: {
      productId, warehouseId, delta, type,
      docType: docType ?? null,
      docId: docId ?? null,
      balanceBefore: current,
      balanceAfter: newQty
    }
  });

  return { balanceBefore: current, balanceAfter: newQty };
}

async function generateReceiptNumber(prisma, warehouseId) {
  const year = new Date().getFullYear();
  const count = await prisma.sale.count({
    where: { warehouseId, createdAt: { gte: new Date(`${year}-01-01`) } }
  });
  return `WH${warehouseId}-${year}-${String(count + 1).padStart(5, '0')}`;
}

function isReturnAllowed(sale, daysLimit = 14) {
  const daysPassed = (Date.now() - new Date(sale.createdAt)) / (1000 * 60 * 60 * 24);
  return daysPassed <= daysLimit;
}

module.exports = { adjustStock, generateReceiptNumber, isReturnAllowed, StockError };
