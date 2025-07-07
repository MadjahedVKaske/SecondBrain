import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Settings, 
  Zap, 
  Shield, 
  BarChart3, 
  Bot, 
  ArrowRight 
} from "lucide-react";
import { Link } from "react-router-dom";

const ServicesSection = () => {
  const services = [
    {
      icon: Settings,
      title: "Внедрение 1С",
      description: "УНФ, БП, УТ и другие конфигурации под ключ",
      features: ["Настройка под бизнес", "Обучение персонала", "Техподдержка"]
    },
    {
      icon: Zap,
      title: "Интеграции",
      description: "Подключение к сайтам, CRM, маркетплейсам, ЭДО",
      features: ["API интеграции", "Синхронизация данных", "Автоматизация"]
    },
    {
      icon: Shield,
      title: "Маркировка",
      description: "Настройка работы с Честным Знаком",
      features: ["Подключение к ГИС МТ", "Обучение работе", "Техподдержка"]
    },
    {
      icon: BarChart3,
      title: "Отчеты и аналитика",
      description: "Создание аналитических отчетов и печатных форм",
      features: ["Кастомные отчеты", "Дашборды", "Аналитика"]
    },
    {
      icon: Bot,
      title: "Telegram-боты",
      description: "Разработка ботов для бизнеса",
      features: ["Уведомления", "Интеграция с 1С", "Автоматизация"]
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Наши услуги
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Полный спектр услуг по автоматизации бизнеса на платформе 1С
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-medium transition-all duration-300 hover:-translate-y-1 border-border"
            >
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <service.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="default" size="lg" asChild>
            <Link to="/services">
              Все услуги
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;