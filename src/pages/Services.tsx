import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Zap, 
  Shield, 
  BarChart3, 
  Bot, 
  Database,
  Globe,
  FileText,
  Smartphone,
  ArrowRight
} from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: Settings,
      title: "Внедрение 1С",
      description: "Полный цикл внедрения конфигураций 1С под ключ",
      services: [
        "1С:Управление нашей фирмой (УНФ)",
        "1С:Бухгалтерия предприятия (БП)",
        "1С:Управление торговлей (УТ)",
        "1С:Зарплата и управление персоналом",
        "1С:CRM и другие отраслевые решения"
      ],
      price: "от 50 000 ₽",
      duration: "1-3 месяца"
    },
    {
      icon: Zap,
      title: "Интеграции",
      description: "Подключение 1С к внешним системам и сервисам",
      services: [
        "Интеграция с интернет-магазинами",
        "Подключение к маркетплейсам (Ozon, WB, Яндекс)",
        "Интеграция с CRM-системами",
        "Подключение к системам ЭДО",
        "API интеграции с банками"
      ],
      price: "от 30 000 ₽",
      duration: "2-4 недели"
    },
    {
      icon: Shield,
      title: "Маркировка товаров",
      description: "Настройка работы с системой маркировки Честный Знак",
      services: [
        "Подключение к ГИС МТ",
        "Настройка печати этикеток",
        "Обучение сотрудников",
        "Настройка отчетности",
        "Сопровождение при внедрении"
      ],
      price: "от 25 000 ₽",
      duration: "1-2 недели"
    },
    {
      icon: BarChart3,
      title: "Отчеты и аналитика",
      description: "Создание кастомных отчетов и аналитических форм",
      services: [
        "Разработка управленческих отчетов",
        "Создание печатных форм",
        "Настройка дашбордов",
        "Аналитические срезы данных",
        "Автоматизация рассылки отчетов"
      ],
      price: "от 15 000 ₽",
      duration: "1-2 недели"
    },
    {
      icon: Bot,
      title: "Telegram-боты",
      description: "Разработка ботов для автоматизации бизнес-процессов",
      services: [
        "Уведомления о важных событиях",
        "Интеграция с 1С через API",
        "Боты для клиентской поддержки",
        "Автоматизация рутинных задач",
        "Мониторинг показателей бизнеса"
      ],
      price: "от 20 000 ₽",
      duration: "1-3 недели"
    },
    {
      icon: Database,
      title: "Оптимизация и доработка",
      description: "Улучшение существующих конфигураций 1С",
      services: [
        "Оптимизация производительности",
        "Доработка функционала",
        "Исправление ошибок",
        "Обновление конфигураций",
        "Миграция данных"
      ],
      price: "от 10 000 ₽",
      duration: "1-4 недели"
    }
  ];

  const advantages = [
    "Сертифицированные специалисты",
    "Гарантия на все работы",
    "Обучение персонала",
    "Фиксированная стоимость",
    "Соблюдение сроков"
  ];

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Наши услуги
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Полный спектр услуг по автоматизации бизнеса на платформе 1С. 
              От консультации до полного сопровождения.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {services.map((service, index) => (
              <Card 
                key={index} 
                className="group hover:shadow-large transition-all duration-300 hover:-translate-y-1 border-border"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <service.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-2">
                        {service.duration}
                      </Badge>
                      <p className="text-lg font-semibold text-primary">
                        {service.price}
                      </p>
                    </div>
                  </div>
                  <CardTitle className="text-2xl mb-2">{service.title}</CardTitle>
                  <CardDescription className="text-muted-foreground text-base">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {service.services.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    Подробнее
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-card rounded-2xl p-8 border border-border shadow-soft">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Преимущества работы с нами
              </h2>
              <p className="text-muted-foreground">
                Почему клиенты выбирают BURO1
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gradient-primary rounded-full"></div>
                  <span className="text-muted-foreground">{advantage}</span>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <Button variant="hero" size="lg">
                Получить консультацию
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Services;