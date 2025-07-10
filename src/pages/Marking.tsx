import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { 
  QrCode, 
  FileText, 
  HelpCircle, 
  Download, 
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";

const Marking = () => {
  const instructions = [
    {
      step: 1,
      title: "Подготовка к подключению",
      description: "Получение необходимых документов и настройка доступов",
      details: [
        "Подача заявления в ФНС для регистрации в ГИС МТ",
        "Получение электронной подписи (КЭП)",
        "Настройка рабочих мест для работы с маркировкой",
        "Проверка технических требований к оборудованию"
      ]
    },
    {
      step: 2,
      title: "Настройка 1С",
      description: "Конфигурирование системы для работы с маркировкой",
      details: [
        "Обновление конфигурации до актуальной версии",
        "Настройка подключения к ГИС МТ",
        "Создание видов номенклатуры для маркированных товаров",
        "Настройка печати этикеток с кодами маркировки"
      ]
    },
    {
      step: 3,
      title: "Тестирование",
      description: "Проверка работы системы в тестовом режиме",
      details: [
        "Проведение тестовых операций в демо-контуре",
        "Проверка корректности формирования документов",
        "Тестирование печати этикеток",
        "Проверка передачи данных в ГИС МТ"
      ]
    },
    {
      step: 4,
      title: "Запуск в работу",
      description: "Переход на промышленную эксплуатацию",
      details: [
        "Переключение на рабочий контур ГИС МТ",
        "Обучение персонала работе с системой",
        "Проведение первых операций под контролем",
        "Настройка мониторинга и отчетности"
      ]
    }
  ];

  const faq = [
    {
      question: "Какие товары подлежат маркировке?",
      answer: "Обязательной маркировке подлежат: лекарственные препараты, табачная продукция, обувь, парфюмерия, шины, фотоаппараты, молочная продукция, пиво и другие категории согласно законодательству."
    },
    {
      question: "Что будет, если не внедрить маркировку?",
      answer: "За нарушение требований маркировки предусмотрены штрафы: для ИП - до 10 000 рублей, для юридических лиц - до 300 000 рублей. Также возможна приостановка деятельности."
    },
    {
      question: "Сколько времени занимает внедрение?",
      answer: "Стандартное внедрение маркировки занимает 1-2 недели, включая настройку системы, обучение персонала и тестирование."
    },
    {
      question: "Какое оборудование необходимо?",
      answer: "Для работы с маркировкой нужен принтер этикеток, сканер штрих-кодов (желательно 2D), компьютер с доступом в интернет и актуальная версия 1С."
    }
  ];

  const documents = [
    {
      title: "Руководство по настройке маркировки в 1С",
      description: "Подробная инструкция по настройке системы",
      type: "PDF",
      size: "2.5 MB"
    },
    {
      title: "Чек-лист проверки готовности к маркировке",
      description: "Список необходимых действий перед запуском",
      type: "PDF",
      size: "1.2 MB"
    },
    {
      title: "Типовые ошибки и их решения",
      description: "Наиболее частые проблемы и способы их устранения",
      type: "PDF",
      size: "0.8 MB"
    }
  ];

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Работа с кодами маркировки
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Полное руководство по внедрению и настройке системы маркировки 
              товаров в 1С с подключением к Честному Знаку
            </p>
          </div>

          <Tabs defaultValue="instructions" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="instructions" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Инструкции</span>
              </TabsTrigger>
              <TabsTrigger value="faq" className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4" />
                <span>FAQ</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Документы</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="instructions">
              <div className="space-y-8">
                <Card className="border-border">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Пошаговое внедрение маркировки</CardTitle>
                        <CardDescription>
                          Следуйте этой инструкции для успешного внедрения
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-6">
                  {instructions.map((instruction, index) => (
                    <Card key={index} className="border-border hover:shadow-medium transition-all">
                      <CardHeader>
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-gradient-accent rounded-full flex items-center justify-center text-accent-foreground font-bold text-lg">
                            {instruction.step}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-xl">{instruction.title}</CardTitle>
                            <CardDescription className="text-base mt-2">
                              {instruction.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {instruction.details.map((detail, detailIndex) => (
                            <li key={detailIndex} className="flex items-start space-x-3">
                              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="faq">
              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center space-x-3">
                      <HelpCircle className="w-8 h-8 text-primary" />
                      <span>Часто задаваемые вопросы</span>
                    </CardTitle>
                    <CardDescription>
                      Ответы на самые популярные вопросы о маркировке
                    </CardDescription>
                  </CardHeader>
                </Card>

                {faq.map((item, index) => (
                  <Card key={index} className="border-border">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-start space-x-3">
                        <Info className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>{item.question}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="documents">
              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center space-x-3">
                      <Download className="w-8 h-8 text-primary" />
                      <span>Полезные документы</span>
                    </CardTitle>
                    <CardDescription>
                      Скачайте инструкции и чек-листы для работы
                    </CardDescription>
                  </CardHeader>
                </Card>

                <div className="grid gap-4">
                  {documents.map((doc, index) => (
                    <Card key={index} className="border-border hover:shadow-medium transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground mb-1">{doc.title}</h3>
                              <p className="text-muted-foreground text-sm mb-2">{doc.description}</p>
                              <div className="flex items-center space-x-4">
                                <Badge variant="secondary">{doc.type}</Badge>
                                <span className="text-xs text-muted-foreground">{doc.size}</span>
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Скачать
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-16 text-center">
            <Card className="border-border bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-8">
                <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Нужна помощь с внедрением?
                </h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Наши специалисты готовы помочь вам с настройкой маркировки в 1С. 
                  Гарантируем соблюдение всех требований законодательства.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="default" size="lg">
                    Заказать внедрение
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/contacts">Получить консультацию</Link>
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

export default Marking;