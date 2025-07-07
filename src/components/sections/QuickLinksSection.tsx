import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  QrCode, 
  Database, 
  CheckCircle2, 
  ArrowRight 
} from "lucide-react";
import { Link } from "react-router-dom";

const QuickLinksSection = () => {
  const quickLinks = [
    {
      icon: QrCode,
      title: "Работа с кодами маркировки",
      description: "Пошаговые инструкции по настройке и использованию маркировки в 1С",
      buttonText: "Перейти к инструкциям",
      href: "/marking",
      color: "bg-gradient-primary"
    },
    {
      icon: Database,
      title: "Какая база мне нужна?",
      description: "Интерактивный помощник поможет выбрать оптимальную конфигурацию 1С",
      buttonText: "Подобрать базу",
      href: "/database-help",
      color: "bg-gradient-accent"
    },
    {
      icon: CheckCircle2,
      title: "В порядке ли у меня 1С?",
      description: "Бесплатный тест для оценки состояния вашей системы 1С",
      buttonText: "Пройти тест",
      href: "/audit",
      color: "bg-gradient-primary"
    }
  ];

  return (
    <section className="py-20 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Полезные инструменты
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Бесплатные инструменты и руководства для работы с 1С
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {quickLinks.map((link, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-large transition-all duration-300 hover:-translate-y-2 border-border relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className={`w-full h-full ${link.color} rounded-full blur-2xl`}></div>
              </div>
              
              <CardHeader className="relative z-10">
                <div className={`w-14 h-14 ${link.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <link.icon className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl mb-2">{link.title}</CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {link.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="relative z-10">
                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  asChild
                >
                  <Link to={link.href}>
                    {link.buttonText}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default QuickLinksSection;