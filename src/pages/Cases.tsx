import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { 
  TrendingUp, 
  Clock, 
  Users, 
  Building2,
  ShoppingCart,
  Factory,
  Truck,
  Filter
} from "lucide-react";

const Cases = () => {
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filters = [
    { id: "all", label: "Все кейсы" },
    { id: "retail", label: "Розничная торговля" },
    { id: "manufacturing", label: "Производство" },
    { id: "logistics", label: "Логистика" },
    { id: "wholesale", label: "Оптовая торговля" }
  ];

  const cases = [
    {
      id: 1,
      title: "Автоматизация сети магазинов «Стиль»",
      description: "Внедрение 1С:УТ для сети из 15 магазинов с интеграцией к маркетплейсам и созданием интернет-магазина",
      industry: "Розничная торговля",
      category: "retail",
      client: "ООО «Стиль»",
      challenge: "Компания использовала устаревшую систему учета, что приводило к ошибкам в остатках и потерям прибыли. Необходимо было автоматизировать все торговые процессы и подключиться к маркетплейсам.",
      solution: [
        "Внедрили 1С:Управление торговлей 11.5",
        "Настроили интеграцию с Ozon, WildBerries, Яндекс.Маркет",
        "Создали интернет-магазин с синхронизацией остатков",
        "Настроили мобильное приложение для работы сотрудников",
        "Обучили 25 сотрудников работе в новой системе"
      ],
      results: [
        "Увеличение оборота на 40% за год",
        "Сокращение ошибок в учете на 95%",
        "Автоматизация 90% рутинных операций",
        "Экономия 15 часов в неделю на отчетности"
      ],
      timeframe: "3 месяца",
      team: "15 сотрудников",
      investment: "850 000 ₽",
      tags: ["1С:УТ", "Маркетплейсы", "Интернет-магазин", "Мобильное приложение"]
    },
    {
      id: 2,
      title: "Система маркировки для «ПроизводПром»",
      description: "Настройка полного цикла работы с Честным Знаком для производственного предприятия",
      industry: "Производство",
      category: "manufacturing",
      client: "ОАО «ПроизводПром»",
      challenge: "Необходимо было в сжатые сроки внедрить систему маркировки товаров в соответствии с требованиями законодательства. Существующая система 1С не поддерживала работу с маркировкой.",
      solution: [
        "Обновили 1С:Управление производственным предприятием",
        "Настроили подключение к ГИС МТ",
        "Внедрили оборудование для печати и сканирования этикеток",
        "Настроили автоматическую отчетность в ЦРПТ",
        "Провели обучение персонала работе с маркировкой"
      ],
      results: [
        "100% соответствие требованиям маркировки",
        "Автоматизация процесса маркировки",
        "Отсутствие штрафов со стороны контролирующих органов",
        "Ускорение отгрузки товаров на 30%"
      ],
      timeframe: "2 месяца",
      team: "25 сотрудников",
      investment: "450 000 ₽",
      tags: ["Честный Знак", "ГИС МТ", "Маркировка", "Производство"]
    },
    {
      id: 3,
      title: "Telegram-бот для логистической компании",
      description: "Разработка бота для автоматических уведомлений о движении товаров и состоянии заказов",
      industry: "Логистика",
      category: "logistics",
      client: "ООО «ЛогистикПлюс»",
      challenge: "Диспетчеры тратили много времени на информирование клиентов о статусе заказов. Нужно было автоматизировать процесс уведомлений и предоставить клиентам возможность самостоятельно отслеживать заказы.",
      solution: [
        "Разработали Telegram-бота с интеграцией в 1С",
        "Настроили автоматические уведомления о статусах заказов",
        "Создали систему трекинга для клиентов",
        "Внедрили возможность оформления заказов через бота",
        "Настроили аналитику и отчетность по работе бота"
      ],
      results: [
        "Ускорение обработки заказов в 3 раза",
        "Сокращение звонков клиентов на 70%",
        "Повышение лояльности клиентов",
        "Экономия 20 часов работы диспетчеров в неделю"
      ],
      timeframe: "1 месяц",
      team: "8 сотрудников",
      investment: "150 000 ₽",
      tags: ["Telegram-бот", "API", "Автоматизация", "Логистика"]
    },
    {
      id: 4,
      title: "Комплексная автоматизация «ОптТорг»",
      description: "Полное внедрение системы управления для оптовой торговой компании",
      industry: "Оптовая торговля",
      category: "wholesale",
      client: "ООО «ОптТорг»",
      challenge: "Растущая компания столкнулась с проблемами в управлении большим ассортиментом товаров, сложностями в планировании закупок и контроле дебиторской задолженности.",
      solution: [
        "Внедрили 1С:Комплексная автоматизация",
        "Настроили CRM для управления клиентами",
        "Автоматизировали планирование закупок",
        "Создали мобильное приложение для торговых представителей",
        "Настроили интеграцию с банком и системой ЭДО"
      ],
      results: [
        "Рост продаж на 35% за полгода",
        "Снижение дебиторской задолженности на 25%",
        "Оптимизация складских остатков на 40%",
        "Автоматизация 85% бизнес-процессов"
      ],
      timeframe: "4 месяца",
      team: "35 сотрудников",
      investment: "1 200 000 ₽",
      tags: ["1С:КА", "CRM", "Мобильное приложение", "ЭДО"]
    }
  ];

  const filteredCases = selectedFilter === "all" 
    ? cases 
    : cases.filter(c => c.category === selectedFilter);

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Успешные кейсы
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Реальные проекты автоматизации бизнеса. Задачи, решения и результаты наших клиентов.
            </p>
          </div>

          {/* Фильтры */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {filters.map((filter) => (
              <Button
                key={filter.id}
                variant={selectedFilter === filter.id ? "default" : "outline"}
                onClick={() => setSelectedFilter(filter.id)}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>{filter.label}</span>
              </Button>
            ))}
          </div>

          {/* Кейсы */}
          <div className="space-y-12">
            {filteredCases.map((caseItem, index) => (
              <Card 
                key={caseItem.id} 
                className="border-border hover:shadow-large transition-all"
              >
                <CardHeader>
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <Badge variant="secondary">{caseItem.industry}</Badge>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{caseItem.client}</span>
                      </div>
                      <CardTitle className="text-2xl lg:text-3xl mb-3">
                        {caseItem.title}
                      </CardTitle>
                      <CardDescription className="text-lg">
                        {caseItem.description}
                      </CardDescription>
                    </div>
                    <div className="grid grid-cols-3 gap-4 lg:w-80">
                      <div className="text-center p-3 bg-secondary rounded-lg">
                        <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Инвестиции</p>
                        <p className="text-sm font-semibold">{caseItem.investment}</p>
                      </div>
                      <div className="text-center p-3 bg-secondary rounded-lg">
                        <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Срок</p>
                        <p className="text-sm font-semibold">{caseItem.timeframe}</p>
                      </div>
                      <div className="text-center p-3 bg-secondary rounded-lg">
                        <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Команда</p>
                        <p className="text-sm font-semibold">{caseItem.team}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid lg:grid-cols-3 gap-8">
                    {/* Задача */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">Задача</h3>
                      <p className="text-muted-foreground">{caseItem.challenge}</p>
                    </div>

                    {/* Решение */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">Решение</h3>
                      <ul className="space-y-2">
                        {caseItem.solution.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start space-x-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Результаты */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">Результаты</h3>
                      <ul className="space-y-2">
                        {caseItem.results.map((result, resultIndex) => (
                          <li key={resultIndex} className="flex items-start space-x-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Теги */}
                  <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-border">
                    {caseItem.tags.map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-16">
            <Card className="border-border bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-8">
                <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Хотите стать следующим успешным кейсом?
                </h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Расскажите о ваших задачах, и мы предложим оптимальное решение 
                  для автоматизации вашего бизнеса.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="default" size="lg">
                    Обсудить проект
                  </Button>
                  <Button variant="outline" size="lg">
                    Получить консультацию
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cases;