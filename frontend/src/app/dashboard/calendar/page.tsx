'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import apiClient from '@/lib/api';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  amount: string;
  type: 'income' | 'expense';
  category?: string;
  status?: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0).toISOString();

      const response = await apiClient.get('/calendar/events', {
        params: { startDate, endDate }
      });

      // Processar eventos do backend
      const processedEvents: CalendarEvent[] = [];
      
      // Transações
      if (response.data.data?.transactions) {
        response.data.data.transactions.forEach((t: any) => {
          processedEvents.push({
            id: t.id,
            date: t.transactionDate,
            title: t.description || 'Transação',
            amount: t.amount,
            type: t.type,
            category: t.category?.name,
            status: t.status
          });
        });
      }

      // Ocorrências de recorrências (A Pagar) - Só mostrar pendentes
      if (response.data.data?.recurringOccurrences) {
        response.data.data.recurringOccurrences
          .filter((occ: any) => occ.status === 'pending') // ✅ Filtrar apenas pendentes
          .forEach((occ: any) => {
            processedEvents.push({
              id: occ.id,
              date: occ.dueDate,
              title: occ.recurringBill?.name || 'Recorrência',
              amount: occ.amount,
              type: occ.recurringBill?.type || 'expense',
              category: occ.recurringBill?.category?.name,
              status: occ.status
            });
          });
      }

      setEvents(processedEvents);
    } catch (error: any) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos do calendário');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (day: number) => {
    const dateStr = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    ).toISOString().split('T')[0];

    return events.filter(event => {
      const eventDate = new Date(event.date).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
    
    // Formatar data para URL (YYYY-MM-DD)
    const dateStr = clickedDate.toISOString().split('T')[0];
    
    // Redirecionar para transações com filtro de data
    router.push(`/dashboard/transactions?date=${dateStr}`);
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value));
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Calcular totais do mês
  const monthTotal = events.reduce((acc, event) => {
    if (event.type === 'income') {
      return acc + Number(event.amount);
    } else {
      return acc - Number(event.amount);
    }
  }, 0);

  const monthIncome = events
    .filter(e => e.type === 'income')
    .reduce((acc, e) => acc + Number(e.amount), 0);

  const monthExpense = events
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 font-['Poppins']">
                Calendário Financeiro
              </h1>
              <p className="text-gray-600 mt-2 font-['Inter']">
                Visualize suas transações e compromissos financeiros
              </p>
            </div>
          </div>

          {/* Estatísticas do Mês */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#22C39A]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Receitas do Mês</p>
                  <p className="text-3xl font-bold text-[#22C39A]">{formatCurrency(monthIncome)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#22C39A]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#E74C3C]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Despesas do Mês</p>
                  <p className="text-3xl font-bold text-[#E74C3C]">{formatCurrency(monthExpense)}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#E74C3C]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#1C6DD0]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Saldo do Mês</p>
                  <p className={`text-3xl font-bold ${monthTotal >= 0 ? 'text-[#22C39A]' : 'text-[#E74C3C]'}`}>
                    {formatCurrency(monthTotal)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-[#1C6DD0]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendário */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Controles de Navegação */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 capitalize">
              {monthName}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Grid do Calendário */}
          <div className="grid grid-cols-7 gap-2">
            {/* Cabeçalho dos dias da semana */}
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div
                key={day}
                className="text-center font-semibold text-gray-600 py-2"
              >
                {day}
              </div>
            ))}

            {/* Dias vazios antes do início do mês */}
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Dias do mês */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayEvents = getEventsForDate(day);
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square border-2 rounded-xl p-2 cursor-pointer transition-all hover:shadow-lg ${
                    isToday
                      ? 'border-[#1C6DD0] bg-blue-50'
                      : 'border-gray-200 hover:border-[#1C6DD0]'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-[#1C6DD0]' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map(event => {
                        const isPositive = Number(event.amount) >= 0;
                        return (
                        <div
                          key={event.id}
                          className={`text-xs px-1 py-0.5 rounded mb-1 truncate ${
                            isPositive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          title={`${event.title} - ${formatCurrency(Math.abs(Number(event.amount)))}`}
                        >
                          {isPositive ? '' : '-'}{formatCurrency(Math.abs(Number(event.amount)))}
                        </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1C6DD0] mx-auto"></div>
              <p className="text-gray-600 mt-4">Carregando eventos...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
