import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Target, 
  Heart, 
  Shield, 
  Users, 
  Award,
  Star,
  Calendar,
  TrendingUp
} from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Результат",
      description: "Мы ориентированы на конкретный результат для клиента, а не на процесс"
    },
    {
      icon: Heart,
      title: "Забота",
      description: "Каждый проект для нас важен, независимо от его размера"
    },
    {
      icon: Shield,
      title: "Надежность",
      description: "Гарантируем качество работы и соблюдение всех договоренностей"
    },
    {
      icon: Users,
      title: "Команда",
      description: "Профессиональная команда сертифицированных специалистов"
    }
  ];

  const team = [
    {
      name: "Борисов Евгений",
      position: "Руководитель проектов",
      experience: "более 15 лет",
      specialization: "Сертифицированный специалист 1С. Внедрение 1С, управление проектами",
      image: "/api/placeholder/200/200"
    },
    {
      name: "Герасимов Алексей",
      position: "Ведущий разработчик",
      experience: "более 10 лет",
      specialization: "Разработка, интеграции, API",
      image: "/api/placeholder/200/200"
    },
    {
      name: "Носырев Дмитрий",
      position: "Разработчик",
      experience: "более 3-х лет",
      specialization: "Честный Знак, ГИС МТ, маркировка",
      image: "/api/placeholder/200/200"
    },
    {
      name: "Семенов Михаил",
      position: "Разработчик",
      experience: "более 10 лет",
      specialization: "Веб и 1С разработка",
      image: "/api/placeholder/200/200"
    }
  ];

  const achievements = [
    { number: "50+", description: "Завершенных проектов", icon: TrendingUp },
    { number: "15", description: "Лет на рынке", icon: Calendar },
    { number: "98%", description: "Довольных клиентов", icon: Star }
  ];

  const testimonials = [
    {
      name: "Ирина Смирнова",
      company: "ООО «Стиль»",
      position: "Генеральный директор",
      text: "BURO1 помогли нам полностью автоматизировать торговые процессы. Результат превзошел ожидания - оборот вырос на 40% за год.",
      rating: 5
    },
    {
      name: "Михаил Волков",
      company: "ОАО «ПроизводПром»",
      position: "IT-директор",
      text: "Профессиональная команда, которая смогла в сжатые сроки внедрить систему маркировки. Все требования законодательства выполнены на 100%.",
      rating: 5
    },
    {
      name: "Елена Морозова",
      company: "ООО «ЛогистикПлюс»",
      position: "Операционный директор",
      text: "Telegram-бот, разработанный BURO1, кардинально изменил нашу работу с клиентами. Теперь все процессы автоматизированы.",
      rating: 5
    }
  ];

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          {/* Hero секция */}
          <div className="text-center mb-20">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              О компании BURO1
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Мы помогаем бизнесу расти с помощью эффективных IT-решений на платформе 1С. 
              15 лет опыта, 50+ успешных проектов, команда сертифицированных специалистов.
            </p>
            
            {/* Достижения */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {achievements.map((achievement, index) => (
                <Card key={index} className="border-border text-center">
                  <CardContent className="p-6">
                    <achievement.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                    <div className="text-3xl font-bold text-foreground mb-2">
                      {achievement.number}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Миссия и ценности */}
          <div className="grid lg:grid-cols-2 gap-12 mb-20">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl">Наша миссия</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Мы делаем бизнес наших клиентов более эффективным и прибыльным 
                  через внедрение современных IT-решений. Наша цель — не просто 
                  автоматизировать процессы, а помочь компаниям достичь новых 
                  высот в развитии.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Мы верим, что правильно настроенная система 1С — это не расход, 
                  а инвестиция, которая окупается в разы.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl">Наши ценности</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {values.map((value, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <value.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{value.title}</h3>
                        <p className="text-muted-foreground text-sm">{value.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Команда */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Наша команда
              </h2>
              <p className="text-xl text-muted-foreground">
                Профессионалы с многолетним опытом работы
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card key={index} className="border-border text-center hover:shadow-medium transition-all">
                  <CardContent className="p-6">
                    <div className="w-24 h-24 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Users className="w-12 h-12 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{member.name}</h3>
                    <p className="text-primary font-medium mb-2">{member.position}</p>
                    <Badge variant="secondary" className="mb-3">
                      {member.experience} опыта
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {member.specialization}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Отзывы */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Отзывы клиентов
              </h2>
              <p className="text-xl text-muted-foreground">
                Что говорят о нас наши клиенты
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="border-border">
                  <CardHeader>
                    <div className="flex items-center space-x-1 mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                      ))}
                    </div>
                    <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                    <CardDescription>
                      {testimonial.position}, {testimonial.company}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground italic">
                      "{testimonial.text}"
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default About;