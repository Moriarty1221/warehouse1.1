class StockError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'StockError';
    this.status = 400;
    this.details = details;
  }
}

// adjustStock — списывает/добавляет остаток
// sizeId → работает с SizeStock и обновляет суммарный Stock
// без sizeId → работает только со Stock
async function adjustStock(tx, { productId, warehouseId, delta, type, docType, docId, sizeId }) {
  if (sizeId) {
    // --- Остаток по размеру ---
    const rows = await tx.$queryRaw`
      SELECT id, quantity, "avgCost", reserved
      FROM "SizeStock"
      WHERE "sizeId" = ${sizeId} AND "warehouseId" = ${warehouseId}
      FOR UPDATE NOWAIT
    `;

    const current = Number(rows[0]?.quantity ?? 0);
    const newQty = current + delta;

    if (newQty < 0) {
      const size = await tx.productSize.findUnique({
        where: { id: sizeId },
        include: { product: { select: { name: true } } }
      });
      throw new StockError(
        `Недостаточно остатков: "${size?.product?.name}" размер ${size?.size} (нужно ${Math.abs(delta)}, есть ${current})`,
        { sizeId, warehouseId, current, needed: Math.abs(delta) }
      );
    }

    if (rows.length > 0) {
      await tx.sizeStock.update({
        where: { sizeId_warehouseId: { sizeId, warehouseId } },
        data: { quantity: newQty }
      });
    } else {
      if (delta < 0) throw new StockError(`Нет записи остатка sizeId=${sizeId}`);
      await tx.sizeStock.create({ data: { sizeId, warehouseId, quantity: newQty } });
    }

    // Пересчитываем суммарный Stock из всех SizeStock
    const allSizeStock = await tx.sizeStock.findMany({
      where: { size: { productId }, warehouseId }
    });
    const totalQty = allSizeStock.reduce((s, r) => s + Number(r.quantity), 0);

    await tx.stock.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { quantity: totalQty },
      create: { productId, warehouseId, quantity: totalQty }
    });

    await tx.stockMovement.create({
      data: {
        productId, warehouseId, sizeId, delta, type,
        docType: docType ?? null,
        docId:   docId   ?? null,
        balanceBefore: current,
        balanceAfter:  newQty
      }
    });

    return { balanceBefore: current, balanceAfter: newQty };
  }

  // --- Обычный товар без размеров ---
  const rows = await tx.$queryRaw`
    SELECT id, quantity, "avgCost", reserved
    FROM "Stock"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE NOWAIT
  `;

  const current = Number(rows[0]?.quantity ?? 0);
  const newQty = current + delta;

  if (newQty < 0) {
    const prod = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
    throw new StockError(
      `Недостаточно остатков: "${prod?.name}" (нужно ${Math.abs(delta)}, есть ${current})`,
      { productId, warehouseId, current, needed: Math.abs(delta) }
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
      docId:   docId   ?? null,
      balanceBefore: current,
      balanceAfter:  newQty
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
