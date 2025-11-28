import React, { createContext, useContext, useState, ReactNode } from 'react';

type CurrencyContextType = {
  currency: string;
  setCurrency: (c: string) => void;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
};

export const CurrencyProvider = ({
  children,
  initialCurrency = "₹",
}: {
  children: ReactNode;
  initialCurrency?: string;
}) => {
  const [currency, setCurrency] = useState<string>(initialCurrency);
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};
