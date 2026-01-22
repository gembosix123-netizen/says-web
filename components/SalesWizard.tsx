"use client";

import React from 'react';
import { SalesProvider, useSales } from '@/context/SalesContext';
import SalesLayout from './layouts/SalesLayout';

// Feature Components
import SalesDashboard from './features/sales/SalesDashboard';
import CheckIn from './features/sales/CheckIn';
import ProductCatalog from './features/sales/ProductCatalog';
import PaymentForm from './features/sales/PaymentForm';
import OrderSummary from './features/sales/OrderSummary';
import SuccessScreen from './features/sales/SuccessScreen';
import ProductExchange from './features/sales/ProductExchange';
import StockAudit from './features/sales/StockAudit';

function SalesWizardContent() {
  const { step } = useSales();

  const renderStep = () => {
    switch (step) {
      case 1: return <SalesDashboard />;
      case 2: return <CheckIn />;
      case 3: return <StockAudit />;
      case 4: return <ProductExchange />;
      case 5: return <ProductCatalog />;
      case 6: return <PaymentForm />;
      case 7: return <OrderSummary />;
      case 8: return <SuccessScreen />;
      default: return <SalesDashboard />;
    }
  };

  return (
    <SalesLayout>
      {renderStep()}
    </SalesLayout>
  );
}

export default function SalesWizard({ role }: { role?: string }) {
  return (
    <SalesProvider initialRole={role}>
      <SalesWizardContent />
    </SalesProvider>
  );
}
