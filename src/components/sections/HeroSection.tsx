import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  const benefits = [
    "15+ лет опыта работы с 1С",
    "500+ успешных проектов",
    "Сертифицированные специалисты"
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/50 to-accent/10 py-20 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5" />
      <div className="absolute top-20 right-20 w-64 h-64 bg-gradient-primary rounded-full opacity-10 blur-3xl" />
      <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-accent rounded-full opacity-10 blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                Автоматизация 
                <span className="bg-gradient-primary bg-clip-text text-transparent"> бизнеса</span> 
                {" "}на платформе 1С
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Профессиональные решения для оптимизации бизнес-процессов. 
                Внедрение, настройка, интеграция и сопровождение систем 1С 
                любой сложности.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="hero" 
                size="xl" 
                className="group"
                asChild
              >
                <Link to="/contacts">
                  Получить консультацию
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="xl"
                asChild
              >
                <Link to="/cases">
                  Посмотреть кейсы
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="bg-card rounded-2xl shadow-large p-8 border border-border">
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xl">1С</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Бесплатная диагностика</h3>
                    <p className="text-muted-foreground">Проверим ваш 1С за 30 минут</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <span className="text-sm text-muted-foreground">Оценка конфигурации</span>
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <span className="text-sm text-muted-foreground">Анализ производительности</span>
                    <div className="w-3 h-3 bg-accent rounded-full"></div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <span className="text-sm text-muted-foreground">Рекомендации по улучшению</span>
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                  </div>
                </div>

                <Button variant="default" className="w-full" asChild>
                  <Link to="/contacts">Заказать диагностику</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;