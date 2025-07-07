import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";

const CasesSection = () => {
  const cases = [
    {
      id: 1,
      title: "Автоматизация торговой сети",
      description: "Внедрение 1С:УТ для сети магазинов с интеграцией к маркетплейсам",
      industry: "Розничная торговля",
      result: "Увеличение оборота на 40%",
      timeframe: "3 месяца",
      team: "15 сотрудников",
      tags: ["1С:УТ", "Маркетплейсы", "Интеграция"],
      image: "/api/placeholder/400/300"
    },
    {
      id: 2,
      title: "Система маркировки для производства",
      description: "Настройка полного цикла работы с Честным Знаком на производстве",
      industry: "Производство",
      result: "100% соответствие требованиям",
      timeframe: "2 месяца",
      team: "25 сотрудников",
      tags: ["Честный Знак", "ГИС МТ", "Производство"],
      image: "/api/placeholder/400/300"
    },
    {
      id: 3,
      title: "Telegram-бот для склада",
      description: "Разработка бота для уведомлений о движении товаров",
      industry: "Логистика",
      result: "Ускорение обработки в 3 раза",
      timeframe: "1 месяц",
      team: "8 сотрудников",
      tags: ["Telegram", "API", "Автоматизация"],
      image: "/api/placeholder/400/300"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Успешные кейсы
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Реальные проекты и их результаты
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {cases.map((caseItem) => (
            <Card 
              key={caseItem.id} 
              className="group hover:shadow-large transition-all duration-300 hover:-translate-y-1 border-border overflow-hidden"
            >
              <div className="h-48 bg-gradient-to-br from-primary/10 to-accent/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>
                <div className="absolute bottom-4 left-4">
                  <Badge variant="secondary" className="bg-background/90">
                    {caseItem.industry}
                  </Badge>
                </div>
              </div>
              
              <CardHeader>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {caseItem.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {caseItem.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="space-y-1">
                      <TrendingUp className="w-5 h-5 text-primary mx-auto" />
                      <p className="text-xs text-muted-foreground">Результат</p>
                      <p className="text-sm font-medium">{caseItem.result}</p>
                    </div>
                    <div className="space-y-1">
                      <Clock className="w-5 h-5 text-primary mx-auto" />
                      <p className="text-xs text-muted-foreground">Срок</p>
                      <p className="text-sm font-medium">{caseItem.timeframe}</p>
                    </div>
                    <div className="space-y-1">
                      <Users className="w-5 h-5 text-primary mx-auto" />
                      <p className="text-xs text-muted-foreground">Команда</p>
                      <p className="text-sm font-medium">{caseItem.team}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {caseItem.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="default" size="lg" asChild>
            <Link to="/cases">
              Все кейсы
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CasesSection;